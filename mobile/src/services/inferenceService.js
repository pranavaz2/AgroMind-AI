/**
 * Inference Service
 * ─────────────────
 * High-level orchestrator that decides between on-device TFLite
 * inference and server-side cloud inference.
 *
 * Strategy:
 *   1. If the TFLite model is loaded → run on-device (instant, offline)
 *   2. If on-device fails or model not loaded → fall back to server API
 *   3. After on-device success and if online → background-sync to server
 *
 * The result format is unified regardless of inference source, so the
 * UI never needs to know which path was taken.
 *
 * Usage:
 *   import { analyzeLeaf, initializeModel } from '../services/inferenceService';
 *
 *   await initializeModel();           // Call once at app boot
 *   const result = await analyzeLeaf(imageAsset);
 *   console.log(result.source);        // 'on-device' or 'server'
 */

import * as OnDeviceModel from './onDeviceModel';
import { parseLabel } from './labelMetadata';
import { buildFarmerAdvice } from './treatmentKnowledge';
import { analyzeCrop, syncOfflineScan } from './scanService';

// ── Public API ──────────────────────────────────────────────────────

/**
 * Initialize the on-device TFLite model.
 * Call once during app startup (e.g. in App.js after splash screen).
 */
export async function initializeModel() {
  try {
    await OnDeviceModel.loadModel();
  } catch (error) {
    // Non-fatal: the app can still work via server inference.
    console.warn('[InferenceService] Model init failed, server fallback active:', error.message);
  }
}

/**
 * Check if on-device inference is available (model loaded and ready).
 * @returns {boolean}
 */
export function isOfflineCapable() {
  return OnDeviceModel.isModelLoaded();
}

/**
 * Get diagnostics about the inference engine state.
 * @returns {{ onDevice: Object, offlineCapable: boolean }}
 */
export function getInferenceStatus() {
  return {
    onDevice: OnDeviceModel.getModelStatus(),
    offlineCapable: isOfflineCapable(),
  };
}

/**
 * Analyze a leaf image for disease prediction.
 *
 * Tries on-device inference first, then falls back to the server API.
 * Returns a unified result format regardless of which path is used.
 *
 * @param {string|Object} imageInput - Local URI string or ImagePicker asset object.
 * @param {Object} [options]
 * @param {boolean} [options.preferOnDevice=true] - Whether to prefer on-device inference.
 * @param {string}  [options.farmId] - Optional farm ID for server sync.
 * @param {boolean} [options.skipServerSync=false] - Skip background sync to server.
 * @returns {Promise<{
 *   prediction: Object,
 *   topPredictions: Array,
 *   advice: Object,
 *   source: 'on-device' | 'server',
 *   processingMs: number,
 *   scan?: Object,
 * }>}
 */
export async function analyzeLeaf(imageInput, options = {}) {
  const {
    preferOnDevice = true,
    farmId = null,
    skipServerSync = false,
  } = options;

  const startTime = Date.now();
  const imageUri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;

  // ── Try on-device inference ─────────────────────────────────────
  if (preferOnDevice && OnDeviceModel.isModelLoaded() && imageUri) {
    try {
      const result = await runOnDeviceInference(imageUri, startTime);

      // Background-sync to server if online (non-blocking)
      if (!skipServerSync) {
        syncToServer(imageInput, result, farmId).catch((err) =>
          console.log('[InferenceService] Background sync skipped:', err.message),
        );
      }

      return result;
    } catch (error) {
      console.warn('[InferenceService] On-device failed, trying server:', error.message);
      // Fall through to server inference
    }
  }

  // ── Fall back to server inference ───────────────────────────────
  return runServerInference(imageInput, farmId, startTime);
}

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Run inference locally using the TFLite model.
 */
async function runOnDeviceInference(imageUri, startTime) {
  const rawPredictions = await OnDeviceModel.predict(imageUri);
  const processingMs = Date.now() - startTime;

  // Normalize predictions with label metadata
  const predictions = rawPredictions.map((item) => {
    const labelMeta = parseLabel(item.label);
    return {
      label: labelMeta.displayName,
      confidence: item.confidence,
      crop_name: labelMeta.cropName,
      disease_name: labelMeta.diseaseName,
      category: labelMeta.category,
      is_healthy: labelMeta.isHealthy,
      label_details: labelMeta,
    };
  });

  const topPrediction = predictions[0];
  const topLabel = topPrediction.label_details;
  const advice = buildFarmerAdvice(topLabel, topPrediction.confidence);

  return {
    prediction: topPrediction,
    topPredictions: predictions,
    advice,
    source: 'on-device',
    processingMs,
    // Build a scan-like wrapper for UI compatibility with server results
    scan: null,
    analysis: {
      model_loaded: true,
      crop_name: topLabel.cropName,
      crop_category: topLabel.category,
      disease_name: topLabel.diseaseName,
      confidence_score: topPrediction.confidence,
      severity: advice.severity,
      treatment_suggestion: advice.treatment_suggestion,
      label_details: topLabel,
      prediction: topPrediction,
      top_predictions: predictions,
      advice,
      processing_ms: processingMs,
    },
  };
}

/**
 * Run inference via the server API (existing flow).
 */
async function runServerInference(imageInput, farmId, startTime) {
  const serverResult = await analyzeCrop(imageInput, farmId);
  const processingMs = Date.now() - startTime;

  // Extract from server response format
  const analysis = serverResult.analysis || serverResult;
  const topPrediction = analysis.prediction || {};
  const topPredictions = analysis.top_predictions || [];

  return {
    prediction: topPrediction,
    topPredictions,
    advice: analysis.advice || {},
    source: 'server',
    processingMs,
    scan: serverResult.scan || null,
    analysis,
  };
}

/**
 * Background-sync an on-device result to the server.
 * Non-blocking: failures are logged but not thrown.
 */
async function syncToServer(imageInput, localResult, farmId) {
  try {
    await syncOfflineScan(imageInput, localResult, farmId);
    console.log('[InferenceService] Synced on-device result to server.');
  } catch {
    // Expected when offline — silently ignored
  }
}
