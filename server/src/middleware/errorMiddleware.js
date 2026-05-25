/**
 * Error Handling Middleware
 * ────────────────────────
 * These two middleware functions handle ALL errors in the application.
 * They must be registered LAST in app.js (after all routes).
 *
 * How Express error handling works:
 * ─────────────────────────────────
 *   Normal middleware:  function(req, res, next)     → 3 arguments
 *   Error middleware:   function(err, req, res, next) → 4 arguments
 *
 *   Express identifies error handlers by their 4 arguments. When any
 *   middleware or controller calls `next(error)` or throws an error,
 *   Express skips all normal middleware and jumps directly to the
 *   error handler.
 *
 * Two types of errors:
 * ────────────────────
 *   1. Operational errors (expected):
 *      - "Email already exists" (409)
 *      - "Invalid password" (401)
 *      - "Image too large" (400)
 *      → These are thrown intentionally with AppError.
 *      → Safe to show the message to the user.
 *
 *   2. Programming errors (unexpected):
 *      - TypeError: Cannot read property 'x' of undefined
 *      - Database connection lost
 *      - Third-party API crash
 *      → These are bugs or infrastructure failures.
 *      → NEVER show the real message to users (security risk).
 */

const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * 404 Not Found Handler
 * ─────────────────────
 * This middleware runs when NO route matched the incoming request URL.
 *
 * Example: If someone calls GET /api/v1/bananas (which doesn't exist),
 * Express goes through all routes, finds no match, and "falls through"
 * to this handler.
 *
 * It creates an AppError with status 404 and passes it to the next
 * middleware — which is the global error handler below.
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Global Error Handler
 * ────────────────────
 * This is the LAST middleware in the pipeline. It catches ALL errors
 * from controllers, services, and other middleware.
 *
 * What it does:
 *   1. Determines if the error is operational (AppError) or a bug
 *   2. Picks the right status code (default: 500)
 *   3. In production: hides internal error details from the response
 *   4. In development: includes the full stack trace for debugging
 *
 * IMPORTANT: This function MUST have exactly 4 parameters (err, req, res, next)
 * even if `next` is not used. Express uses the parameter count to identify
 * this as an error handler. Removing `next` would break error handling.
 */
function errorHandler(err, req, res, next) {
  // Default to 500 if no status code was set.
  const statusCode = err.statusCode || 500;

  // Is this an error we threw on purpose (AppError)?
  const isOperational = err.isOperational || false;

  // ── Choose what message to show ──────────────────────────────────
  let message;

  if (env.isProduction && !isOperational) {
    // In production, hide internal error details from the API response.
    // Showing "Cannot read property 'email' of undefined" to users is:
    //   1. Confusing (they can't fix it)
    //   2. A security risk (reveals code structure to attackers)
    message = 'Something went wrong on the server.';
  } else {
    // In development, or for operational errors, show the real message.
    message = err.message;
  }

  // ── Log the error for developers ─────────────────────────────────
  // Always log the full error server-side, even in production.
  // In a real production app, you'd send this to Sentry, Datadog, etc.
  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ❌ ${err.message}`);
    if (!env.isProduction) {
      console.error(err.stack);
    }
  }

  // ── Send the response ────────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    // Only include the stack trace in development for debugging.
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
