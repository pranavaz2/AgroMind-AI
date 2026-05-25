/**
 * Cloudinary Configuration
 * ────────────────────────
 * Cloudinary is a cloud-based image/video management service.
 * We use it instead of storing files on our own server because:
 *   1. It handles image optimization (resizing, compression) automatically.
 *   2. It serves images via a global CDN for fast loading worldwide.
 *   3. It removes the burden of managing disk space on our server.
 *
 * This file initializes the Cloudinary SDK with our account credentials
 * from environment variables and exports the configured instance.
 */

const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true, // Always use HTTPS URLs for delivered images.
});

module.exports = cloudinary;
