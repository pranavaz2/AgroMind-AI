/**
 * Upload Service
 * ──────────────
 * Handles uploading file buffers to Cloudinary via a Node.js stream.
 *
 * Why stream instead of writing to disk first?
 *   - Faster: No disk I/O step.
 *   - Cleaner: No temp files to delete.
 *   - Memory-efficient: The buffer flows through a stream pipeline.
 *
 * The `streamifier` package converts a Buffer (from Multer's memoryStorage)
 * into a readable stream that Cloudinary's `upload_stream` can consume.
 */

const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const AppError = require('../utils/AppError');

/**
 * Upload a single image buffer to Cloudinary.
 *
 * @param {Buffer}  fileBuffer  - The raw file data from `req.file.buffer`.
 * @param {Object}  options     - Upload options.
 * @param {string}  options.folder       - Cloudinary folder (e.g., "crop-scans").
 * @param {string}  [options.publicId]   - Custom public ID; auto-generated if omitted.
 * @param {string}  [options.userId]     - Tag the upload with the user ID for auditing.
 *
 * @returns {Promise<Object>} Cloudinary upload result with url, publicId, etc.
 */
async function uploadImage(fileBuffer, { folder, publicId, userId } = {}) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError('No file data provided.', 400);
  }

  return new Promise((resolve, reject) => {
    // Cloudinary's `upload_stream` accepts a writable stream.
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `agromind/${folder || 'general'}`,

        // Cloudinary will generate a unique ID if we don't set one.
        public_id: publicId || undefined,

        // Image-specific optimizations:
        resource_type: 'image',
        overwrite: true,
        invalidate: true,

        // Transformations applied on upload (eager transformations):
        transformation: [
          {
            quality: 'auto',   // Cloudinary picks the best quality/size balance.
            fetch_format: 'auto', // Serve WebP to browsers that support it, JPEG otherwise.
          },
        ],

        // Tags help organize and search uploads in the Cloudinary dashboard.
        tags: [
          'agromind',
          folder || 'general',
          userId ? `user:${userId}` : 'anonymous',
        ],

        // Context metadata stored alongside the image.
        context: {
          uploaded_by: userId || 'system',
          app: 'agromind-ai',
        },
      },
      (error, result) => {
        if (error) {
          return reject(
            new AppError(`Image upload failed: ${error.message}`, 502)
          );
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    // Pipe the in-memory buffer into Cloudinary's upload stream.
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
}

/**
 * Upload multiple image buffers to Cloudinary in parallel.
 *
 * @param {Array<Buffer>}  fileBuffers  - Array of raw file buffers.
 * @param {Object}         options      - Same options as uploadImage.
 *
 * @returns {Promise<Array<Object>>} Array of Cloudinary upload results.
 */
async function uploadMultipleImages(fileBuffers, options = {}) {
  if (!fileBuffers || fileBuffers.length === 0) {
    throw new AppError('No files provided.', 400);
  }

  const uploadPromises = fileBuffers.map((buffer) =>
    uploadImage(buffer, options)
  );

  return Promise.all(uploadPromises);
}

/**
 * Delete an image from Cloudinary by its public ID.
 *
 * @param {string} publicId - The Cloudinary public_id to delete.
 */
async function deleteImage(publicId) {
  if (!publicId) {
    throw new AppError('Public ID is required to delete an image.', 400);
  }

  const result = await cloudinary.uploader.destroy(publicId);

  if (result.result !== 'ok') {
    throw new AppError(`Failed to delete image: ${publicId}`, 502);
  }

  return { deleted: true, publicId };
}

module.exports = {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
};
