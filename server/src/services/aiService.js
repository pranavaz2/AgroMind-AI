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
  try {
    const response = await axios.get(buildFastApiUrl('/health'), { timeout: 3000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Analyzes a leaf image using the local FastAPI MobileNetV2 model.
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

  try {
    const formData = new FormData();
    const extension = mimeType?.split('/')[1] || 'jpeg';
    
    // Append the file buffer to the form data. FastAPI expects the key "file".
    formData.append('file', imageBuffer, {
      filename: `leaf.${extension}`,
      contentType: mimeType || 'image/jpeg',
    });

    const response = await axios.post(
      buildFastApiUrl('/api/predict'),
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
    
    if (!result || !result.success || !result.data) {
      throw new AppError('Invalid response format received from AI service.', 502);
    }

    const { data } = result;

    // Normalizing the response to standard backend schema
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

  } catch (error) {
    throw toFastApiError(error);
  }
}

module.exports = {
  analyzeLeafImage,
  checkAiServiceHealth
};
