/**
 * AI Service
 * ──────────
 * Handles communication with the FastAPI TensorFlow prediction service.
 * The Gemini fallback has been removed to enforce strict reliance on the 
 * custom-trained MobileNetV2 architecture.
 */

const env = require('../config/env');
const AppError = require('../utils/AppError');
const axios = require('axios');
const FormData = require('form-data');

function buildFastApiUrl(endpoint = '/api/predict') {
  const baseUrl = env.aiServiceUrl.replace(/\/$/, '');
  return `${baseUrl}${endpoint}`;
}

function toFastApiError(error) {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.data?.error || 'FastAPI service error';
      return new AppError(`AI Service Error: ${detail}`, status);
    }

    if (error.code === 'ECONNABORTED') {
      return new AppError('AI prediction timed out. The model may still be loading. Please try again.', 504);
    }

    return new AppError('AI Prediction Service is currently unavailable. Please ensure the FastAPI backend is running.', 503);
  }

  return new AppError(error.message || 'AI service request failed unexpectedly.', 502);
}

/**
 * Health check to verify FastAPI is online before attempting large image uploads.
 */
async function checkAiServiceHealth() {
  const healthEndpoints = ['/api/v1/health', '/health'];
  
  for (const endpoint of healthEndpoints) {
    try {
      const url = buildFastApiUrl(endpoint);
      const response = await axios.get(url, { timeout: 3000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Continue to try next health endpoint
    }
  }
  return false;
}

/**
 * Analyzes a leaf image using the local FastAPI MobileNetV2 model.
 * Supports both new production route and legacy fallback route.
 * 
 * @param {Buffer} imageBuffer - Raw image bytes
 * @param {string} mimeType - e.g., 'image/jpeg'
 * @returns {Promise<Object>} Normalized AI prediction result
 */
async function analyzeLeafImage(imageBuffer, mimeType) {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new AppError('No image data provided for analysis.', 400);
  }

  if (!env.aiServiceUrl) {
    throw new AppError('FastAPI AI service URL is not configured (AI_SERVICE_URL).', 503);
  }

  const formData = new FormData();
  const extension = mimeType?.split('/')[1] || 'jpeg';
  
  // Append the file buffer under both keys to support old ("file") and new ("image") FastAPI endpoints.
  const fileOptions = {
    filename: `leaf.${extension}`,
    contentType: mimeType || 'image/jpeg',
  };
  formData.append('file', imageBuffer, fileOptions);
  formData.append('image', imageBuffer, fileOptions);

  const predictionEndpoints = [
    { path: '/api/v1/predictions/leaf-disease', isNew: true },
    { path: '/api/predict', isNew: false }
  ];

  let lastError = null;

  for (const endpoint of predictionEndpoints) {
    try {
      const url = buildFastApiUrl(endpoint.path);
      const response = await axios.post(
        url,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Accept: 'application/json',
          },
          timeout: env.aiServiceTimeoutMs || 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const result = response.data;
      if (!result) continue;

      if (endpoint.isNew) {
        // Normalize response from production /api/v1/predictions/leaf-disease endpoint
        const topPredictions = (result.top_predictions || []).map(p => ({
          class: p.label_details?.raw_label || p.label,
          confidence: p.confidence
        }));

        return {
          diseaseName: result.label_details?.raw_label || result.disease_name,
          displayName: result.label_details?.display_name || result.prediction?.label || result.disease_name,
          confidence: result.confidence_score,
          severity: result.severity,
          treatment: result.treatment_suggestion,
          prevention: Array.isArray(result.prevention_tips) ? result.prevention_tips.join('\n') : (result.prevention_tips || ''),
          predictionTimeMs: result.processing_ms,
          topPredictions,
          modelVersion: "mobilenet_v2_v1",
          predictionSource: "tensorflow_fastapi",
          predictionTimestamp: new Date().toISOString()
        };
      } else {
        // Normalize response from legacy /api/predict endpoint
        if (!result.success || !result.data) {
          continue;
        }
        const { data } = result;
        return {
          diseaseName: data.disease,
          displayName: data.display_name,
          confidence: data.confidence,
          severity: data.severity,
          treatment: data.treatment,
          prevention: data.prevention,
          predictionTimeMs: data.prediction_time_ms,
          topPredictions: data.top_predictions || [],
          modelVersion: "mobilenet_v2_v1",
          predictionSource: "tensorflow_fastapi",
          predictionTimestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      lastError = error;
      // If endpoint fails or returns 404/500, we proceed to try the fallback endpoint
    }
  }

  throw toFastApiError(lastError || new Error('All prediction service routes failed.'));
}

module.exports = {
  analyzeLeafImage,
  checkAiServiceHealth
};
