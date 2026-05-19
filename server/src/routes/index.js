/**
 * API Route Registry (Barrel File)
 * ────────────────────────────────
 * This file is the CENTRAL HUB for all API routes. Every route group
 * is registered here with a URL prefix.
 *
 * How routing works in Express:
 * ─────────────────────────────
 *   1. app.js says: app.use('/api/v1', apiRoutes)
 *   2. This file says: router.use('/auth', authRoutes)
 *   3. authRoutes.js says: router.post('/login', login)
 *
 *   Combined: POST /api/v1/auth/login → authController.login
 *
 * Why a barrel file?
 *   Instead of registering each route group in app.js (which would make
 *   it very long), we centralize all route registration here. app.js
 *   just mounts this one router at /api/v1, keeping the main file clean.
 *
 * Adding a new route group:
 *   1. Create the route file: routes/tipRoutes.js
 *   2. Add it here: router.use('/tips', require('./tipRoutes'))
 *   That's it. The new endpoints are live at /api/v1/tips/*
 *
 * Current API structure:
 *   /api/v1/auth     → Registration, login, profile
 *   /api/v1/health   → Server health check
 *   /api/v1/upload   → Image upload/delete (Cloudinary)
 *   /api/v1/scans    → Crop disease scanning (AI)
 */

const express = require('express');
const authRoutes = require('./authRoutes');
const farmRoutes = require('./farmRoutes');
const healthRoutes = require('./healthRoutes');
const uploadRoutes = require('./uploadRoutes');
const scanRoutes = require('./scanRoutes');
const weatherRoutes = require('./weatherRoutes');
const voiceAssistantRoutes = require('./voiceAssistantRoutes');
const notificationRoutes = require('./notificationRoutes');
const communityRoutes = require('./communityRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/farms', farmRoutes);
router.use('/health', healthRoutes);
router.use('/upload', uploadRoutes);
router.use('/scans', scanRoutes);
router.use('/weather', weatherRoutes);
router.use('/voice', voiceAssistantRoutes);
router.use('/notifications', notificationRoutes);
router.use('/community', communityRoutes);

module.exports = router;
