/**
 * Farm Service
 * ────────────
 * Functions that call the backend farm API endpoints.
 *
 * All endpoints require authentication — the JWT token is automatically
 * attached by the apiClient interceptor (no manual header needed).
 *
 * Usage in screens:
 *   import { createFarm, getUserFarms } from '../services/farmService';
 *
 *   const farms = await getUserFarms();
 *   const newFarm = await createFarm({ name: 'Green Valley', location: 'Punjab' });
 */

import apiClient from './apiClient';

/**
 * Create a new farm.
 *
 * @param {Object}  data
 * @param {string}  data.name      - Farm name (required)
 * @param {string}  [data.location] - Farm location
 * @param {number}  [data.size]     - Farm size
 * @param {string}  [data.unit]     - 'ACRE' or 'HECTARE' (default: ACRE)
 *
 * @returns {Promise<{ farm: Object }>}
 */
export async function createFarm({ name, location, size, unit }) {
  const response = await apiClient.post('/farms', {
    name,
    location,
    size,
    unit,
  });
  return response.data.data;
}

/**
 * Get all farms for the logged-in user.
 * Returns farms with scan count (how many scans are linked to each farm).
 *
 * @returns {Promise<{ farms: Array }>}
 */
export async function getUserFarms() {
  const response = await apiClient.get('/farms');
  return response.data.data;
}

/**
 * Update a farm.
 *
 * @param {string}  farmId  - The farm's UUID
 * @param {Object}  data    - Fields to update (name, location, size, unit)
 *
 * @returns {Promise<{ farm: Object }>}
 */
export async function updateFarm(farmId, data) {
  const response = await apiClient.patch(`/farms/${farmId}`, data);
  return response.data.data;
}

/**
 * Delete a farm.
 * Scans linked to this farm will keep their data but lose the farm association.
 *
 * @param {string}  farmId  - The farm's UUID
 *
 * @returns {Promise<void>}
 */
export async function deleteFarm(farmId) {
  const response = await apiClient.delete(`/farms/${farmId}`);
  return response.data;
}
