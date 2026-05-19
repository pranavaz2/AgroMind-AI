/**
 * Scan Service
 *
 * Sends leaf images to the Node backend for AI disease analysis.
 *
 * Flow:
 *   1. User picks an image from camera or gallery.
 *   2. The app creates a FormData payload with the image file.
 *   3. The app posts it to /scans as multipart/form-data.
 *   4. The Node backend uploads to Cloudinary and forwards the image to FastAPI.
 *   5. The Python service runs TensorFlow inference and returns prediction JSON.
 *   6. Node saves the scan and returns the normalized result to the app.
 */

import apiClient from './apiClient';

function getImageUploadParts(imageInput) {
  const imageUri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;

  if (!imageUri) {
    throw new Error('Please choose a crop image before scanning.');
  }

  const assetName = typeof imageInput === 'object' ? imageInput.fileName : null;
  const filename = assetName || imageUri.split('/').pop() || 'leaf.jpg';
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = (typeof imageInput === 'object' && imageInput.mimeType)
    || (ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : ext === 'heic' ? 'image/heic'
    : ext === 'heif' ? 'image/heif'
    : 'image/jpeg');

  return { imageUri, filename, mimeType };
}

/**
 * Upload a leaf image and get AI disease analysis.
 *
 * @param {string|Object} imageInput - Local URI or ImagePicker asset.
 * @param {string} [farmId] - Optional farm to associate the scan with.
 * @param {Function} [onUploadProgress] - Callback to track upload progress percentage.
 *
 * @returns {Promise<{ scan: Object, analysis: Object }>}
 */
export async function analyzeCrop(imageInput, farmId, onUploadProgress) {
  const { imageUri, filename, mimeType } = getImageUploadParts(imageInput);
  const formData = new FormData();

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  });

  if (farmId) {
    formData.append('farmId', farmId);
  }

  const response = await apiClient.post('/scans', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percentCompleted);
      }
    }
  });

  return response.data.data;
}

/**
 * Get all past scans for the logged-in user.
 *
 * @returns {Promise<{ scans: Array }>}
 */
export async function getUserScans() {
  const response = await apiClient.get('/scans');
  return response.data.data;
}

/**
 * Get a specific scan by ID.
 *
 * @param {string} scanId - The scan's UUID.
 * @returns {Promise<Object>}
 */
export async function getScanById(scanId) {
  const response = await apiClient.get(`/scans/${scanId}`);
  return response.data.data;
}

/**
 * Retry AI analysis for a failed scan.
 *
 * @param {string} scanId - The scan's UUID.
 * @returns {Promise<Object>}
 */
export async function retryScan(scanId) {
  const response = await apiClient.post(`/scans/${scanId}/retry`);
  return response.data.data;
}

/**
 * Sync an on-device prediction to the server for history tracking.
 *
 * Called in the background after a successful on-device inference
 * when the device has network connectivity. The server stores the
 * scan result without re-running inference.
 *
 * @param {string|Object} imageInput - Local URI or ImagePicker asset.
 * @param {Object} localResult - The on-device prediction result.
 * @param {string} [farmId] - Optional farm to associate the scan with.
 * @returns {Promise<Object>}
 */
export async function syncOfflineScan(imageInput, localResult, farmId) {
  const { imageUri, filename, mimeType } = getImageUploadParts(imageInput);
  const formData = new FormData();

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  });

  if (farmId) {
    formData.append('farmId', farmId);
  }

  // Attach the local prediction so the server can skip re-inference
  formData.append('localPrediction', JSON.stringify({
    source: 'on-device',
    crop_name: localResult.analysis?.crop_name,
    disease_name: localResult.analysis?.disease_name,
    confidence_score: localResult.analysis?.confidence_score,
    severity: localResult.analysis?.severity,
    treatment_suggestion: localResult.analysis?.treatment_suggestion,
  }));

  const response = await apiClient.post('/scans', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

  return response.data.data;
}
