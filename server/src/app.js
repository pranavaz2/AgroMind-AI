/**
 * Express Application Configuration
 * ──────────────────────────────────
 * This file creates and configures the Express application. It does NOT
 * start the server — that's done in server.js. This separation lets us
 * import the app for testing without actually listening on a port.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    MIDDLEWARE PIPELINE                       │
 * │                                                             │
 * │  Every HTTP request flows through these layers in ORDER:    │
 * │                                                             │
 * │  Request → helmet → cors → rateLimit → json parser →       │
 * │  morgan → route matching → controller → response            │
 * │                                                             │
 * │  If any layer throws an error:                              │
 * │  ... → notFoundHandler → errorHandler → error response      │
 * └─────────────────────────────────────────────────────────────┘
 *
 * What is middleware?
 *   Middleware is a function that runs BETWEEN receiving a request and
 *   sending a response. Each middleware can:
 *     1. Modify the request (e.g., parse JSON body, attach user object)
 *     2. Modify the response (e.g., add security headers)
 *     3. End the request (e.g., reject unauthorized users)
 *     4. Call next() to pass control to the next middleware
 *
 *   Think of it as a conveyor belt: the request passes through each
 *   station, gets processed, and moves to the next one.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const env = require('./config/env');

const app = express();

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE LAYER 1: SECURITY HEADERS (Helmet)
// ═══════════════════════════════════════════════════════════════════════
//
// What it does:
//   Helmet adds ~15 HTTP security headers to every response. These headers
//   tell browsers to enable built-in security features.
//
// Key headers it sets:
//   - X-Content-Type-Options: nosniff    → Prevents MIME type confusion attacks
//   - X-Frame-Options: SAMEORIGIN        → Prevents clickjacking (embedding in iframes)
//   - Strict-Transport-Security          → Forces HTTPS connections
//   - X-XSS-Protection                   → Enables browser XSS filters
//
// Why it matters:
//   Without these headers, browsers use their default (less secure) behavior.
//   A single app.use(helmet()) protects against many common web attacks.

app.use(helmet());

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE LAYER 2: CORS (Cross-Origin Resource Sharing)
// ═══════════════════════════════════════════════════════════════════════
//
// What is CORS?
//   By default, browsers BLOCK requests from one domain to another.
//   Your React Native app calls http://your-server.com/api — the browser
//   (or WebView) considers this a "cross-origin" request and blocks it
//   unless the server explicitly allows it.
//
// Configuration:
//   - Development: Allow ALL origins ('*') for easy testing
//   - Production: Only allow your frontend's domain (CLIENT_URL)
//
// credentials: true → Allows the browser to send cookies/auth headers

app.use(
  cors({
    origin: (origin, callback) => {
      if (env.clientUrl === '*' || !origin || origin === env.clientUrl) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE LAYER 3: RATE LIMITING (API abuse protection)
// ═══════════════════════════════════════════════════════════════════════
//
// What it does:
//   Limits how many requests a single IP address can make in a time window.
//   This protects against:
//     - Brute-force password attacks
//     - Denial-of-service (DoS) flooding
//     - Scraping / automated abuse
//
// Configuration:
//   - General API: 100 requests per 15 minutes per IP
//   - Auth endpoints: 20 requests per 15 minutes per IP (stricter)
//
// What happens when the limit is exceeded?
//   The server responds with HTTP 429 (Too Many Requests) and a message.

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15-minute window
  max: 100,                    // Max 100 requests per window per IP
  standardHeaders: true,       // Send rate limit info in `RateLimit-*` headers
  legacyHeaders: false,        // Don't send the old `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests. Please try again in a few minutes.',
  },
});

// Stricter rate limit for login/signup to prevent brute-force attacks.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

// Apply the general limiter to ALL routes.
app.use(generalLimiter);

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE LAYER 4: BODY PARSERS
// ═══════════════════════════════════════════════════════════════════════
//
// What they do:
//   express.json()       → Parses request bodies with Content-Type: application/json
//   express.urlencoded() → Parses request bodies with Content-Type: application/x-www-form-urlencoded
//
// Why limit: '10mb'?
//   Without a limit, an attacker could send a 1GB JSON payload and crash
//   the server's memory. 10MB is generous for leaf images sent as base64.
//
// What happens to the parsed body?
//   It's attached to `req.body` — so when the mobile app sends:
//     { "email": "farmer@example.com", "password": "secret123" }
//   Your controller can access it as: req.body.email, req.body.password

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE LAYER 5: REQUEST LOGGING (Morgan — dev only)
// ═══════════════════════════════════════════════════════════════════════
//
// What it does:
//   Prints every HTTP request to the console in a colored format:
//     POST /api/v1/auth/login 200 45ms
//
// Why dev-only?
//   In production, you'd use a structured logger (like Winston or Pino)
//   that writes to files or a log aggregation service — not the console.

if (!env.isProduction) {
  app.use(morgan('dev'));
}

// ═══════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════
//
// How Express routing works:
//   app.use('/api/v1', apiRoutes) means "for any request starting with
//   /api/v1, delegate to the apiRoutes router to find a matching handler."
//
// The apiRoutes barrel (routes/index.js) then delegates further:
//   /api/v1/auth/*   → authRoutes   → authController
//   /api/v1/scans/*  → scanRoutes   → scanController
//   /api/v1/upload/* → uploadRoutes → uploadController
//   /api/v1/health   → healthRoutes → healthController
//
// Why /api/v1?
//   Versioning your API (v1) means you can release v2 with breaking changes
//   without breaking existing mobile app versions that still use v1.

// Root health check — useful for deployment platforms (Render, Railway, etc.)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to AgroMind AI API',
  });
});

// Apply stricter rate limit to auth endpoints specifically.
app.use('/api/v1/auth', authLimiter);

// Mount all API routes under /api/v1.
app.use('/api/v1', apiRoutes);

// ═══════════════════════════════════════════════════════════════════════
// ERROR HANDLERS (must be LAST — after all routes)
// ═══════════════════════════════════════════════════════════════════════
//
// Why are error handlers last?
//   Express processes middleware in ORDER. If a route isn't found, the
//   request "falls through" all routes and hits the 404 handler.
//   If any middleware/controller throws an error, Express skips to the
//   error handler (the one with 4 arguments: err, req, res, next).

// 404 handler — catches requests to routes that don't exist.
app.use(notFoundHandler);

// Global error handler — catches ALL errors from controllers/services.
app.use(errorHandler);

module.exports = app;
