/**
 * Upload Routes
 * ─────────────
 * All upload endpoints are protected — the user must be logged in.
 *
 * Route structure:
 *   POST   /api/v1/upload/single       → Upload one image
 *   POST   /api/v1/upload/multiple     → Upload up to 5 images
 *   DELETE /api/v1/upload/:publicId    → Delete an image by its Cloudinary public ID
 */

const express = require('express');
const { uploadSingle, uploadMultiple, deleteSingle } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// All upload routes require authentication.
router.use(protect);

// Single image upload.
// `upload.single('image')` tells Multer to expect ONE file in the "image" form field.
router.post('/single', upload.single('image'), handleMulterError, uploadSingle);

// Multiple image upload.
// `upload.array('images', 5)` tells Multer to expect up to 5 files in the "images" form field.
router.post('/multiple', upload.array('images', 5), handleMulterError, uploadMultiple);

// Delete an image.
// Cloudinary public IDs contain slashes (e.g., "agromind/crop-scans/abc123"),
// so we use a wildcard parameter (*publicId) to capture the full path.
// Express 5 uses path-to-regexp v8 where wildcards use the *name syntax.
// The client should URL-encode the publicId when calling this endpoint.
router.delete('/*publicId', deleteSingle);

module.exports = router;
