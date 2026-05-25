/**
 * AI Service
 *
 * Uses the Python TensorFlow microservice for leaf disease predictions when it
 * is available. Gemini remains as a fallback so scans can still complete while
 * the local model service is offline or before a trained model is installed.
 */

const genAI = require('../config/gemini');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const GEMINI_MODEL_NAME = 'gemini-2.5-flash';
const PYTHON_AI_TIMEOUT_MS = 30000;

const DISEASE_DETECTION_PROMPT = `You are an expert agricultural plant pathologist AI assistant for the AgroMind AI app.

Analyze the provided leaf/crop image and return a JSON response with the following structure. Return ONLY the JSON object, no markdown, no code fences, no extra text.

{
  "isLeaf": true,
  "cropName": "Name of the crop/plant (e.g., Tomato, Rice, Wheat)",
  "diseaseName": "Name of the detected disease, or 'Healthy' if no disease",
  "isHealthy": false,
  "confidence": 85.5,
  "severity": "Moderate",
  "description": "A brief 2-3 sentence description of the disease, what causes it, and how it affects the crop.",
  "symptoms": [
    "Symptom 1 observed in the image",
    "Symptom 2 observed in the image",
    "Symptom 3 observed in the image"
  ],
  "treatment": [
    "Treatment recommendation 1",
    "Treatment recommendation 2",
    "Treatment recommendation 3"
  ],
  "prevention": [
    "Prevention tip 1",
    "Prevention tip 2",
    "Prevention tip 3"
  ]
}

Rules:
1. "confidence" must be a number between 0 and 100 representing your certainty.
2. "severity" must be one of: "None", "Low", "Moderate", "High", "Critical".
3. If the plant is healthy, set "diseaseName" to "Healthy", "isHealthy" to true, "severity" to "None", and still provide prevention tips.
4. If the image is NOT a leaf or crop image, set "isLeaf" to false, and fill all other fields with "N/A" or empty arrays.
5. Keep descriptions practical and farmer-friendly. Avoid overly technical jargon.
6. Treatment recommendations should include both organic and chemical options when applicable.`;

function normalizeSeverity(severity, isHealthy, confidence) {
  if (isHealthy) return 'None';
  if (severity === 'needs_attention') return confidence >= 80 ? 'High' : 'Moderate';
  if (severity === 'uncertain') return 'Low';
  if (['None', 'Low', 'Moderate', 'High', 'Critical'].includes(severity)) return severity;
  return confidence >= 80 ? 'High' : confidence >= 60 ? 'Moderate' : 'Low';
}

function normalizeMicroserviceResponse(payload) {
  const topPrediction = payload?.prediction || {};
  const advice = payload?.advice || {};
  const diseaseName = topPrediction.label || 'Unknown';
  const confidence = Math.round(Number(topPrediction.confidence || 0) * 1000) / 10;
  const isHealthy = diseaseName.toLowerCase().includes('healthy');
  const nextSteps = Array.isArray(advice.next_steps) ? advice.next_steps : [];

  return {
    isLeaf: true,
    cropName: 'Unknown',
    diseaseName,
    isHealthy,
    confidence,
    severity: normalizeSeverity(advice.severity, isHealthy, confidence),
    description: advice.summary || `The model prediction is ${diseaseName}.`,
    symptoms: isHealthy ? [] : [`Possible visual signs matching ${diseaseName}.`],
    treatment: isHealthy ? [] : nextSteps,
    prevention: isHealthy ? nextSteps : [advice.safety_note].filter(Boolean),
    source: payload?.model_loaded ? 'tensorflow' : 'tensorflow-demo',
    rawPrediction: payload,
  };
}

async function analyzeWithPythonService(imageBuffer, mimeType) {
  if (!env.aiServiceUrl) {
    throw new AppError('Python AI service URL is not configured.', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PYTHON_AI_TIMEOUT_MS);

  try {
    const formData = new FormData();
    const extension = mimeType?.split('/')[1] || 'jpeg';
    const blob = new Blob([imageBuffer], { type: mimeType || 'image/jpeg' });
    formData.append('image', blob, `leaf.${extension}`);

    const response = await fetch(
      `${env.aiServiceUrl.replace(/\/$/, '')}/api/v1/predictions/leaf-disease`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AppError(
        payload?.detail || `Python AI service returned ${response.status}.`,
        response.status
      );
    }

    return normalizeMicroserviceResponse(payload);
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeWithGemini(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');

  const response = await genAI.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType || 'image/jpeg',
            },
          },
          { text: DISEASE_DETECTION_PROMPT },
        ],
      },
    ],
  });

  const rawText = response.text;
  if (!rawText) {
    throw new AppError('AI returned an empty response.', 502);
  }

  const cleanedText = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  return JSON.parse(cleanedText);
}

async function analyzeLeafImage(imageBuffer, mimeType) {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new AppError('No image data provided for analysis.', 400);
  }

  const provider = String(env.aiProvider || 'auto').toLowerCase();

  if (provider === 'gemini') {
    return analyzeWithGemini(imageBuffer, mimeType);
  }

  try {
    return await analyzeWithPythonService(imageBuffer, mimeType);
  } catch (pythonError) {
    if (provider === 'python') {
      throw pythonError;
    }

    try {
      return await analyzeWithGemini(imageBuffer, mimeType);
    } catch (geminiError) {
      if (geminiError instanceof SyntaxError) {
        throw new AppError(
          'AI returned an invalid response format. Please try again.',
          502
        );
      }

      if (geminiError.status === 429) {
        throw new AppError(
          'AI service is temporarily overloaded. Please try again in a moment.',
          429
        );
      }

      if (geminiError.status === 403) {
        throw new AppError(
          'AI service authentication failed. Please contact support.',
          503
        );
      }

      throw new AppError(
        `AI analysis failed: ${geminiError.message || pythonError.message || 'Unknown error'}`,
        502
      );
    }
  }
}

module.exports = {
  analyzeLeafImage,
};
