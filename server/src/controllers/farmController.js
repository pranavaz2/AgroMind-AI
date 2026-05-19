/**
 * Farm Controller
 * ───────────────
 * Handles HTTP requests for farm management endpoints.
 * All endpoints require authentication (protect middleware).
 *
 * Endpoints:
 *   POST   /api/v1/farms      → Create a new farm
 *   GET    /api/v1/farms      → List all farms for the logged-in user
 *   PATCH  /api/v1/farms/:id  → Update a farm
 *   DELETE /api/v1/farms/:id  → Delete a farm
 */

const {
  createFarm,
  getUserFarms,
  updateFarm,
  deleteFarm,
} = require('../services/farmService');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/v1/farms
 * Create a new farm for the logged-in user.
 */
const create = asyncHandler(async (req, res) => {
  const { name, location, size, unit } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('Farm name is required.', 400);
  }

  if (unit && !['ACRE', 'HECTARE'].includes(unit)) {
    throw new AppError('Unit must be ACRE or HECTARE.', 400);
  }

  if (size !== undefined && (isNaN(size) || size < 0)) {
    throw new AppError('Size must be a positive number.', 400);
  }

  const farm = await createFarm({
    name,
    location,
    size,
    unit,
    userId: req.user.id,
  });

  return sendCreated(res, 'Farm created successfully.', { farm });
});

/**
 * GET /api/v1/farms
 * List all farms belonging to the logged-in user.
 */
const getAll = asyncHandler(async (req, res) => {
  const farms = await getUserFarms(req.user.id);

  return sendSuccess(res, 'Farms fetched successfully.', { farms });
});

/**
 * PATCH /api/v1/farms/:id
 * Update a specific farm (must belong to the logged-in user).
 */
const update = asyncHandler(async (req, res) => {
  const { name, location, size, unit } = req.body;

  if (unit && !['ACRE', 'HECTARE'].includes(unit)) {
    throw new AppError('Unit must be ACRE or HECTARE.', 400);
  }

  if (size !== undefined && (isNaN(size) || size < 0)) {
    throw new AppError('Size must be a positive number.', 400);
  }

  const farm = await updateFarm(req.params.id, req.user.id, {
    name,
    location,
    size,
    unit,
  });

  return sendSuccess(res, 'Farm updated successfully.', { farm });
});

/**
 * DELETE /api/v1/farms/:id
 * Delete a specific farm (must belong to the logged-in user).
 * Scans linked to this farm will have their farmId set to null.
 */
const remove = asyncHandler(async (req, res) => {
  await deleteFarm(req.params.id, req.user.id);

  return sendSuccess(res, 'Farm deleted successfully.');
});

module.exports = {
  create,
  getAll,
  update,
  remove,
};
