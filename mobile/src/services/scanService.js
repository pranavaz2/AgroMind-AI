/**
 * Scan Service
 * ────────────
 * Sends leaf images to the backend for AI disease analysis.
 *
 * Flow:
 *   1. User picks an image (camera or gallery)
 *   2. We create a FormData object with the image file
 *   3. We POST it to /scans (multipart/form-data, NOT JSON)
 *   4. Backend uploads to Cloudinary + sends to Gemini AI
 *   5. Backend returns the scan result with disease analysis
 *
 * Why FormData instead of JSON?
 *   JSON can only contain text. Images are binary data.
 *   FormData is the standard way to upload files over HTTP —
 *   it encodes the file as multipart/form-data, which the backend's
 *   Multer middleware knows how to parse.
 */

import apiClient from './apiClient';

/**
 * Upload a leaf image and get AI disease analysis.
 *
 * @param {string}  imageUri  - Local file URI from ImagePicker
 * @param {string}  [farmId]  - Optional farm to associate the scan with
 *
 * @returns {Promise<{ scan: Object, analysis: Object }>}
 */
export async function analyzeCrop(imageUri, farmId) {
  // Build a FormData object — this is how files are sent over HTTP.
  const formData = new FormData();

  // Extract the filename and determine MIME type from the URI.
  const filename = imageUri.split('/').pop() || 'leaf.jpg';
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg';

  // React Native's FormData accepts this object format for files.
  // The 'uri' tells fetch() to read the file from the device's filesystem.
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  });

  if (farmId) {
    formData.append('farmId', farmId);
  }

  // Send with multipart headers — Axios will set the boundary automatically
  // when it detects FormData as the body.
  const response = await apiClient.post('/scans', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // AI analysis can take up to 60 seconds
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
 * @param {string} scanId - The scan's UUID
 * @returns {Promise<Object>}
 */
export async function getScanById(scanId) {
  const response = await apiClient.get(`/scans/${scanId}`);
  return response.data.data;
}

/**
 * Retry AI analysis for a failed scan.
 *
 * @param {string} scanId - The scan's UUID
 * @returns {Promise<Object>}
 */
export async function retryScan(scanId) {
  const response = await apiClient.post(`/scans/${scanId}/retry`);
  return response.data.data;
}
