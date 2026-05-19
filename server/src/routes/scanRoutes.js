/**
 * Scan Routes
 * ───────────
 * All scan endpoints require authentication.
 *
 * Route structure:
 *   POST   /api/v1/scans            → Upload leaf image + get AI analysis
 *   GET    /api/v1/scans            → List all scans for the logged-in user
 *   GET    /api/v1/scans/:id        → Get a single scan by ID
 *   POST   /api/v1/scans/:id/retry  → Retry AI analysis for a failed scan
 */

const express = require('express');
const { create, getAll, getOne, retry } = require('../controllers/scanController');
const { protect } = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/optionalAuthMiddleware');
const { upload, handleMulterError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// MVP BYPASS: Make the scan creation public (optional auth)
router.post('/', optionalAuth, upload.single('image'), handleMulterError, create);

// The rest of the routes still require strict authentication (for history/retries)
router.use(protect);

// List all scans for the logged-in user.
router.get('/', getAll);

// Get a specific scan by ID.
router.get('/:id', getOne);

// Retry AI analysis for a failed scan.
router.post('/:id/retry', retry);

module.exports = router;
