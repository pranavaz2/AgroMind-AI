/**
 * Auth Routes
 * ───────────
 * Route structure:
 *   POST  /api/v1/auth/register  → Create a new account
 *   POST  /api/v1/auth/login     → Login and get JWT token
 *   GET   /api/v1/auth/me        → Get current user profile (protected)
 *   PATCH /api/v1/auth/profile   → Update profile (protected)
 *   PATCH /api/v1/auth/password  → Change password (protected)
 */

const express = require('express');
const { getMe, login, register, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no token needed)
router.post('/register', register);
router.post('/login', login);

// Protected routes (valid JWT required)
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.patch('/password', protect, changePassword);

module.exports = router;
