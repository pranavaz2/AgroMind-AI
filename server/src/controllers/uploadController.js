/**
 * Upload Controller
 * ─────────────────
 * Handles HTTP requests for image uploads.
 * All upload endpoints require authentication (the `protect` middleware
 * runs before these controllers, so `req.user` is always available).
 */

const { uploadImage, uploadMultipleImages, deleteImage } = require('../services/uploadService');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/v1/upload/single
 * Upload a single image.
 *
 * Form field name: "image"
 * Optional query param: ?folder=crop-scans
 */
const uploadSingle = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please attach an image file (field name: "image").', 400);
  }

  const folder = req.query.folder || req.body.folder || 'general';

  const result = await uploadImage(req.file.buffer, {
    folder,
    userId: req.user.id,
  });

  return sendCreated(res, 'Image uploaded successfully.', result);
});

/**
 * POST /api/v1/upload/multiple
 * Upload up to 5 images at once.
 *
 * Form field name: "images"
 * Optional query param: ?folder=crop-scans
 */
const uploadMultiple = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('Please attach at least one image file (field name: "images").', 400);
  }

  const folder = req.query.folder || req.body.folder || 'general';

  const buffers = req.files.map((file) => file.buffer);

  const results = await uploadMultipleImages(buffers, {
    folder,
    userId: req.user.id,
  });

  return sendCreated(res, `${results.length} image(s) uploaded successfully.`, results);
});

/**
 * DELETE /api/v1/upload/:publicId
 * Delete an image from Cloudinary.
 *
 * The publicId includes the folder path (e.g., "agromind/crop-scans/abc123").
 * It is passed as a URL-encoded path parameter.
 */
const deleteSingle = asyncHandler(async (req, res) => {
  // Express 5 wildcard params (*publicId) return an array of path segments.
  // e.g., DELETE /upload/agromind/crop-scans/abc123
  //   → req.params.publicId = ['agromind', 'crop-scans', 'abc123']
  // Join them back into the full Cloudinary public ID string.
  const rawId = req.params.publicId;
  const publicId = Array.isArray(rawId) ? rawId.join('/') : rawId;

  if (!publicId) {
    throw new AppError('Image public ID is required.', 400);
  }

  const result = await deleteImage(publicId);

  return sendSuccess(res, 'Image deleted successfully.', result);
});

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteSingle,
};
