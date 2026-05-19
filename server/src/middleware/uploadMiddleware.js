/**
 * Upload Middleware (Multer Configuration)
 * ────────────────────────────────────────
 * Multer is an Express middleware for handling "multipart/form-data",
 * which is the encoding type used when uploading files through forms.
 *
 * How it works:
 *   1. The client sends a POST request with a file attached.
 *   2. Multer intercepts the request BEFORE it reaches the controller.
 *   3. It validates the file (type, size) and either accepts or rejects it.
 *   4. If accepted, the file is available at `req.file` (single) or `req.files` (multiple).
 *
 * Storage strategy:
 *   We use `memoryStorage()` instead of `diskStorage()` because we don't
 *   want to save files to the server's hard drive. Instead, we keep the
 *   file in RAM temporarily (as a Buffer) and stream it directly to
 *   Cloudinary. This avoids disk I/O and the need to clean up temp files.
 */

const multer = require('multer');
const AppError = require('../utils/AppError');

// ── Allowed MIME types ──────────────────────────────────────────────────
// Only these image formats are accepted. This prevents users from
// uploading executables, scripts, or other dangerous file types.
const ALLOWED_MIME_TYPES = [
  'image/jpeg',   // .jpg, .jpeg
  'image/png',    // .png
  'image/webp',   // .webp  (modern, smaller file size)
  'image/heic',   // .heic  (iPhone photos)
  'image/heif',   // .heif  (iPhone photos variant)
];

// ── Size limit ──────────────────────────────────────────────────────────
// 5 MB max. Crop photos from phone cameras are typically 2-4 MB.
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes

/**
 * File filter — runs for every incoming file.
 * Rejects the upload early if the MIME type is not in our allow-list.
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true); // Accept the file.
  } else {
    cb(
      new AppError(
        `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, HEIC.`,
        400
      ),
      false // Reject the file.
    );
  }
}

// ── Create the Multer instance ──────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(), // Store in RAM, not on disk.
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files per request (for batch uploads).
  },
});

/**
 * Middleware to handle Multer errors with user-friendly messages.
 * Multer throws its own error types (e.g., LIMIT_FILE_SIZE), so we
 * catch them and convert to our AppError format.
 */
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
      LIMIT_FILE_COUNT: 'Too many files. Maximum is 5 files per upload.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field name.',
    };
    return next(new AppError(messages[err.code] || err.message, 400));
  }
  next(err);
}

module.exports = {
  upload,
  handleMulterError,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
