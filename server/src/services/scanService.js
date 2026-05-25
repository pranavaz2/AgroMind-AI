/**
 * Scan Service
 * ────────────
 * Orchestrates the full crop scan workflow:
 *   1. Upload the leaf image to Cloudinary (permanent storage).
 *   2. Send the image to Gemini AI for disease analysis.
 *   3. Save the scan result to the database (CropScan table).
 *
 * This service coordinates between uploadService, aiService, and Prisma.
 * It acts as the "director" that calls each service in the right order.
 *
 * Why separate upload and AI into different services?
 *   - Single Responsibility: Each service does one thing well.
 *   - Reusability: uploadService can be used for profile photos too.
 *   - Testability: Each service can be tested independently.
 *   - Error isolation: If AI fails, the upload is still saved.
 */

const { prisma } = require('../config/db');
const { uploadImage } = require('./uploadService');
const { analyzeLeafImage } = require('./aiService');
const { notifyScanCompleted } = require('./notificationService');
const AppError = require('../utils/AppError');

/**
 * Perform a full crop scan: upload → AI analysis → save to database.
 *
 * @param {Object}  params
 * @param {Buffer}  params.imageBuffer  - Raw image bytes from Multer.
 * @param {string}  params.mimeType     - MIME type of the image.
 * @param {string}  params.userId       - Authenticated user's ID.
 * @param {string}  [params.farmId]     - Optional farm to associate the scan with.
 *
 * @returns {Promise<Object>} The saved CropScan record with AI results.
 */
async function createScan({ imageBuffer, mimeType, userId, farmId }) {
  // ── Step 1: Upload the leaf image to Cloudinary ───────────────────
  // We upload first so the image is safely stored regardless of whether
  // the AI analysis succeeds or fails.
  const uploadResult = await uploadImage(imageBuffer, {
    folder: 'crop-scans',
    userId,
  });

  // ── Step 2: Send the image to Gemini AI for analysis ──────────────
  // The AI needs the raw buffer (not the Cloudinary URL) because it
  // processes the image directly via base64 encoding.
  let aiResult;
  let scanStatus = 'COMPLETED';

  try {
    aiResult = await analyzeLeafImage(imageBuffer, mimeType);
  } catch (error) {
    // If AI fails, we still save the scan with FAILED status.
    // The user can see their uploaded image and retry the analysis later.
    scanStatus = 'FAILED';
    aiResult = null;
  }

  // ── Step 3: Validate the farm belongs to this user (if provided) ──
  if (farmId) {
    const farm = await prisma.farm.findFirst({
      where: { id: farmId, ownerId: userId },
    });
    if (!farm) {
      throw new AppError('Farm not found or does not belong to you.', 404);
    }
  }

  // ── Step 4: Save the scan to the database ─────────────────────────
  const scan = await prisma.cropScan.create({
    data: {
      cropName: aiResult?.cropName || 'Unknown',
      imageUrl: uploadResult.url,
      aiSummary: aiResult ? JSON.stringify(aiResult) : null,
      status: scanStatus,
      confidence: aiResult?.confidence || null,
      userId,
      farmId: farmId || null,
    },
  });

  notifyScanCompleted({ userId, scan, analysis: aiResult }).catch((error) => {
    console.warn('Scan notification failed:', error.message);
  });

  // ── Step 5: Return the scan with parsed AI data ───────────────────
  return {
    scan: {
      id: scan.id,
      cropName: scan.cropName,
      imageUrl: scan.imageUrl,
      status: scan.status,
      confidence: scan.confidence ? Number(scan.confidence) : null,
      createdAt: scan.createdAt,
    },
    analysis: aiResult,
  };
}

/**
 * Get all scans for a user, newest first.
 *
 * @param {string}  userId  - Authenticated user's ID.
 * @returns {Promise<Array>} Array of CropScan records.
 */
async function getUserScans(userId) {
  const scans = await prisma.cropScan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      farm: {
        select: { id: true, name: true },
      },
    },
  });

  // Parse the JSON aiSummary back into an object for each scan.
  return scans.map((scan) => ({
    id: scan.id,
    cropName: scan.cropName,
    imageUrl: scan.imageUrl,
    status: scan.status,
    confidence: scan.confidence ? Number(scan.confidence) : null,
    farm: scan.farm,
    analysis: scan.aiSummary ? JSON.parse(scan.aiSummary) : null,
    createdAt: scan.createdAt,
  }));
}

/**
 * Get a single scan by ID (must belong to the requesting user).
 *
 * @param {string}  scanId  - The scan's UUID.
 * @param {string}  userId  - Authenticated user's ID.
 * @returns {Promise<Object>} The scan with parsed AI data.
 */
async function getScanById(scanId, userId) {
  const scan = await prisma.cropScan.findFirst({
    where: { id: scanId, userId },
    include: {
      farm: {
        select: { id: true, name: true },
      },
    },
  });

  if (!scan) {
    throw new AppError('Scan not found.', 404);
  }

  return {
    id: scan.id,
    cropName: scan.cropName,
    imageUrl: scan.imageUrl,
    status: scan.status,
    confidence: scan.confidence ? Number(scan.confidence) : null,
    farm: scan.farm,
    analysis: scan.aiSummary ? JSON.parse(scan.aiSummary) : null,
    createdAt: scan.createdAt,
  };
}

/**
 * Retry AI analysis for a failed scan.
 * Downloads the image from Cloudinary and re-sends to Gemini.
 *
 * @param {string}  scanId  - The scan's UUID.
 * @param {string}  userId  - Authenticated user's ID.
 * @returns {Promise<Object>} The updated scan with new AI results.
 */
async function retryScan(scanId, userId) {
  const scan = await prisma.cropScan.findFirst({
    where: { id: scanId, userId },
  });

  if (!scan) {
    throw new AppError('Scan not found.', 404);
  }

  if (scan.status === 'COMPLETED') {
    throw new AppError('This scan has already been analyzed successfully.', 400);
  }

  if (!scan.imageUrl) {
    throw new AppError('No image found for this scan. Please create a new scan.', 400);
  }

  // Fetch the image from Cloudinary to re-analyze.
  const fetch = (await import('node-fetch')).default;
  const imageResponse = await fetch(scan.imageUrl);

  if (!imageResponse.ok) {
    throw new AppError('Could not retrieve the scan image. Please create a new scan.', 502);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

  // Re-analyze with Gemini.
  const aiResult = await analyzeLeafImage(imageBuffer, contentType);

  // Update the scan in the database.
  const updatedScan = await prisma.cropScan.update({
    where: { id: scanId },
    data: {
      cropName: aiResult.cropName || scan.cropName,
      aiSummary: JSON.stringify(aiResult),
      status: 'COMPLETED',
      confidence: aiResult.confidence || null,
    },
  });

  notifyScanCompleted({ userId, scan: updatedScan, analysis: aiResult }).catch((error) => {
    console.warn('Scan retry notification failed:', error.message);
  });

  return {
    scan: {
      id: updatedScan.id,
      cropName: updatedScan.cropName,
      imageUrl: updatedScan.imageUrl,
      status: updatedScan.status,
      confidence: updatedScan.confidence ? Number(updatedScan.confidence) : null,
      createdAt: updatedScan.createdAt,
    },
    analysis: aiResult,
  };
}

module.exports = {
  createScan,
  getUserScans,
  getScanById,
  retryScan,
};
