/**
 * On-Device TFLite Model
 * ──────────────────────
 * Loads and runs the bundled TensorFlow Lite model for on-device
 * leaf disease prediction. No network required.
 *
 * Architecture:
 *   1. loadModel() — loads the .tflite from bundled assets at app startup.
 *   2. predict(imageUri) — preprocesses image, runs inference, returns
 *      raw softmax probabilities mapped to class names.
 *   3. releaseModel() — frees the interpreter when backgrounded.
 *
 * The TFLite interpreter is cached and reused across predictions.
 * Image preprocessing matches the server pipeline:
 *   - Resize to 224×224
 *   - Normalize pixel values to [0, 1]
 *   - Shape: [1, 224, 224, 3] float32 batch
 */

import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';

// Only attempt to load the native module if we are NOT in Expo Go
let loadTensorflowModel = null;
try {
  if (Constants.appOwnership !== 'expo') {
    const tflite = require('react-native-tflite');
    loadTensorflowModel = tflite.loadTensorflowModel;
  }
} catch (e) {
  console.warn('[OnDeviceModel] Native TFLite module is missing.');
}

// Bundled model assets
const MODEL_ASSET = require('../../assets/model/leaf_disease.tflite');
const CLASS_NAMES_ASSET = require('../../assets/model/class_names.json');
const MANIFEST_ASSET = require('../../assets/model/mobile_model_manifest.json');

// Model configuration
const IMAGE_SIZE = 224;

// ── Module State ────────────────────────────────────────────────────

let model = null;
let classNames = null;
let manifest = null;
let loadError = null;
let isLoading = false;

// ── Public API ──────────────────────────────────────────────────────

/**
 * Check if the TFLite model is loaded and ready for inference.
 * @returns {boolean}
 */
export function isModelLoaded() {
  return model !== null && classNames !== null;
}

/**
 * Get model status for diagnostics.
 * @returns {{ loaded: boolean, error: string|null, classCount: number, manifest: Object|null }}
 */
export function getModelStatus() {
  return {
    loaded: isModelLoaded(),
    loading: isLoading,
    error: loadError,
    classCount: classNames ? classNames.length : 0,
    manifest,
  };
}

/**
 * Load the TFLite model and class names from bundled assets.
 * This should be called once at app startup.
 * Subsequent calls are no-ops if the model is already loaded.
 */
export async function loadModel() {
  if (isModelLoaded() || isLoading) return;

  isLoading = true;
  loadError = null;

  try {
    // Load class names and manifest (these are JSON, imported directly)
    classNames = CLASS_NAMES_ASSET;
    manifest = MANIFEST_ASSET;

    // Resolve the model asset to a local file URI
    const [modelAsset] = await Asset.loadAsync(MODEL_ASSET);
    const modelUri = modelAsset.localUri || modelAsset.uri;

    if (!modelUri) {
      throw new Error('Could not resolve TFLite model asset to a local file path.');
    }

    if (!loadTensorflowModel) {
      throw new Error('TFLite native module is not available in Expo Go.');
    }

    // Load TFLite model via react-native-tflite
    model = await loadTensorflowModel(modelUri);

    console.log(
      `[OnDeviceModel] Loaded successfully. Classes: ${classNames.length}, ` +
      `Size: ${manifest?.tflite_size_mb || '?'} MB`
    );
  } catch (error) {
    model = null;
    loadError = error.message || 'Failed to load TFLite model.';
    console.error('[OnDeviceModel] Load failed:', loadError);
  } finally {
    isLoading = false;
  }
}

/**
 * Run inference on a local image URI.
 *
 * @param {string} imageUri - Local file URI of the leaf image.
 * @returns {Promise<Array<{ label: string, confidence: number }>>}
 *   Top predictions sorted by confidence (descending).
 *
 * @throws {Error} If the model is not loaded.
 */
export async function predict(imageUri) {
  if (!isModelLoaded()) {
    throw new Error('TFLite model is not loaded. Call loadModel() first.');
  }

  try {
    // Read image as base64 for preprocessing
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Run inference through the TFLite model
    // react-native-tflite handles image preprocessing internally:
    // - Decodes the image
    // - Resizes to the model's input size (224x224)
    // - Normalizes pixel values based on model quantization
    const output = await model.run([base64]);

    // output is a Float32Array or similar typed array of probabilities
    const probabilities = Array.from(output[0]);

    // Map probabilities to class names and sort by confidence
    const predictions = classNames
      .map((label, index) => ({
        label,
        confidence: index < probabilities.length ? probabilities[index] : 0,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return predictions;
  } catch (error) {
    console.error('[OnDeviceModel] Inference failed:', error.message);
    throw new Error(`On-device inference failed: ${error.message}`);
  }
}

/**
 * Release the model interpreter to free memory.
 * Call when the app moves to the background.
 */
export function releaseModel() {
  if (model) {
    // react-native-tflite models are garbage-collected,
    // but we null the reference to allow GC to reclaim memory.
    model = null;
    console.log('[OnDeviceModel] Released model interpreter.');
  }
}

/**
 * Get the expected image size for preprocessing.
 * @returns {number}
 */
export function getImageSize() {
  return manifest?.input?.image_size || IMAGE_SIZE;
}

/**
 * Get the loaded class names.
 * @returns {string[]|null}
 */
export function getClassNames() {
  return classNames;
}
