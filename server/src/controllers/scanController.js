/**
 * Scan Controller
 * ───────────────
 * Handles HTTP requests for the crop scan endpoints.
 * All endpoints require authentication (protect middleware).
 *
 * Controller responsibilities:
 *   - Validate the incoming request (is a file attached? is the ID valid?).
 *   - Call the appropriate service function.
 *   - Send the HTTP response with the correct status code.
 *
 * Controllers do NOT contain business logic — that lives in the services.
 */

const {
  createScan,
  getUserScans,
  getScanById,
  retryScan,
} = require('../services/scanService');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/v1/scans
 * Upload a leaf image and get AI disease analysis.
 *
 * Expects: multipart/form-data with field "image" (the leaf photo).
 * Optional body field: "farmId" (UUID of the farm to associate with).
 */
const create = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(
      'Please attach a leaf image (field name: "image").',
      400
    );
  }

  const result = await createScan({
    imageBuffer: req.file.buffer,
    mimeType: req.file.mimetype,
    userId: req.user.id,
    farmId: req.body.farmId || null,
  });

  return sendCreated(res, 'Crop scan completed successfully.', result);
});

/**
 * GET /api/v1/scans
 * Get all scans for the logged-in user.
 */
const getAll = asyncHandler(async (req, res) => {
  const scans = await getUserScans(req.user.id);

  return sendSuccess(res, 'Scans fetched successfully.', { scans });
});

/**
 * GET /api/v1/scans/:id
 * Get a single scan by its ID.
 */
const getOne = asyncHandler(async (req, res) => {
  const scan = await getScanById(req.params.id, req.user.id);

  return sendSuccess(res, 'Scan fetched successfully.', { scan });
});

/**
 * POST /api/v1/scans/:id/retry
 * Retry AI analysis for a failed scan.
 */
const retry = asyncHandler(async (req, res) => {
  const result = await retryScan(req.params.id, req.user.id);

  return sendSuccess(res, 'Scan re-analyzed successfully.', result);
});

module.exports = {
  create,
  getAll,
  getOne,
  retry,
};
