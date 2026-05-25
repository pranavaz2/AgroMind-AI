/**
 * Farm Service
 * ────────────
 * Business logic for managing farms (CRUD operations).
 *
 * Every function checks OWNERSHIP — a user can only access their own farms.
 * This is a critical security pattern: even if someone guesses a farm ID,
 * they can't view or modify it unless they own it.
 *
 * CRUD = Create, Read, Update, Delete — the 4 basic database operations.
 */

const { prisma } = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * Create a new farm for the logged-in user.
 *
 * @param {Object}  params
 * @param {string}  params.name      - Farm name (required)
 * @param {string}  [params.location] - Farm location (optional)
 * @param {number}  [params.size]     - Farm size (optional)
 * @param {string}  [params.unit]     - ACRE or HECTARE (default: ACRE)
 * @param {string}  params.userId     - Owner's user ID (from req.user)
 * @returns {Promise<Object>} The created farm
 */
async function createFarm({ name, location, size, unit, userId }) {
  const farm = await prisma.farm.create({
    data: {
      name: name.trim(),
      location: location?.trim() || null,
      size: size || null,
      unit: unit || 'ACRE',
      ownerId: userId,
    },
  });

  return farm;
}

/**
 * Get all farms belonging to the logged-in user.
 * Includes a count of scans per farm for the dashboard.
 *
 * @param {string} userId - The logged-in user's ID
 * @returns {Promise<Array>} Array of farm objects
 */
async function getUserFarms(userId) {
  const farms = await prisma.farm.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      // Count how many scans are linked to each farm.
      // This is useful for the mobile app to show "12 scans" on each farm card.
      _count: {
        select: { cropScans: true },
      },
    },
  });

  // Flatten the _count field for a cleaner API response.
  return farms.map((farm) => ({
    id: farm.id,
    name: farm.name,
    location: farm.location,
    size: farm.size ? Number(farm.size) : null,
    unit: farm.unit,
    scanCount: farm._count.cropScans,
    createdAt: farm.createdAt,
  }));
}

/**
 * Update a farm (only if the logged-in user owns it).
 *
 * @param {string} farmId  - The farm's UUID
 * @param {string} userId  - The logged-in user's ID
 * @param {Object} updates - Fields to update (name, location, size, unit)
 * @returns {Promise<Object>} The updated farm
 */
async function updateFarm(farmId, userId, updates) {
  // First verify the farm exists AND belongs to this user.
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, ownerId: userId },
  });

  if (!farm) {
    throw new AppError('Farm not found.', 404);
  }

  // Build the update object with only the fields that were provided.
  // This prevents overwriting existing values with null.
  const data = {};
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.location !== undefined) data.location = updates.location?.trim() || null;
  if (updates.size !== undefined) data.size = updates.size;
  if (updates.unit !== undefined) data.unit = updates.unit;

  const updatedFarm = await prisma.farm.update({
    where: { id: farmId },
    data,
  });

  return updatedFarm;
}

/**
 * Delete a farm (only if the logged-in user owns it).
 * Associated crop scans will have their farmId set to null (not deleted).
 *
 * @param {string} farmId - The farm's UUID
 * @param {string} userId - The logged-in user's ID
 */
async function deleteFarm(farmId, userId) {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, ownerId: userId },
  });

  if (!farm) {
    throw new AppError('Farm not found.', 404);
  }

  await prisma.farm.delete({
    where: { id: farmId },
  });

  return { deleted: true };
}

module.exports = {
  createFarm,
  getUserFarms,
  updateFarm,
  deleteFarm,
};
