/**
 * Farm Routes
 * ───────────
 * All farm endpoints require authentication.
 *
 * Route structure:
 *   POST   /api/v1/farms      → Create a new farm
 *   GET    /api/v1/farms      → List all farms for the logged-in user
 *   PATCH  /api/v1/farms/:id  → Update a farm
 *   DELETE /api/v1/farms/:id  → Delete a farm
 */

const express = require('express');
const { create, getAll, update, remove } = require('../controllers/farmController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All farm routes require authentication.
router.use(protect);

router.post('/', create);
router.get('/', getAll);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
