/**
 * Gemini AI Configuration
 * ───────────────────────
 * Initializes the Google Generative AI (Gemini) SDK.
 *
 * What is Gemini?
 *   Gemini is Google's family of multimodal AI models. "Multimodal" means
 *   they can understand text AND images together in a single prompt.
 *   For AgroMind, we send a leaf photo + a text prompt asking for disease
 *   analysis, and Gemini returns a structured diagnosis.
 *
 * Why Gemini 2.5 Flash?
 *   - Fast: ~1-3 seconds per response (critical for mobile UX).
 *   - Cheap: Significantly lower cost than Pro/Ultra models.
 *   - Accurate: Excellent at image recognition tasks.
 *   - Multimodal: Natively understands images without extra steps.
 *
 * This file exports a configured GoogleGenAI instance that the AI service
 * uses to send requests. The API key comes from the .env file and is
 * validated at server startup by env.js.
 */

const { GoogleGenAI } = require('@google/genai');
const env = require('./env');

const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

module.exports = genAI;
