/**
 * Auth Controller
 * ───────────────
 * Handles HTTP requests for authentication endpoints.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    CONTROLLER RESPONSIBILITIES                      │
 * │                                                                     │
 * │  A controller does exactly 3 things:                                │
 * │    1. VALIDATE the incoming request (are required fields present?) │
 * │    2. CALL the appropriate service function                        │
 * │    3. SEND the HTTP response with the correct status code          │
 * │                                                                     │
 * │  Controllers do NOT:                                                │
 * │    ❌ Hash passwords (that's the service's job)                    │
 * │    ❌ Query the database directly (that's the service's job)       │
 * │    ❌ Send emails (that would be a notification service)           │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Endpoints:
 *   POST /api/v1/auth/register  → Create a new account
 *   POST /api/v1/auth/login     → Login and receive a JWT token
 *   GET  /api/v1/auth/me        → Get the logged-in user's profile
 */

const { loginUser, registerUser, updateUserProfile, changeUserPassword } = require('../services/authService');
const { sendCreated, sendSuccess } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ── Input Validation ────────────────────────────────────────────────
// These functions validate the raw request body BEFORE passing it to
// the service layer. This keeps validation logic centralized and
// prevents invalid data from reaching the database.
//
// Why validate here instead of in the service?
//   The controller knows about HTTP (req.body, status codes).
//   The service knows about business logic (hashing, DB queries).
//   Validation is an HTTP concern — "is the request well-formed?"

/**
 * Validate the registration request body.
 * Throws AppError (400) if any field is invalid.
 */
function validateRegisterBody(body) {
  const { fullName, email, password } = body;

  if (!fullName || !email || !password) {
    throw new AppError('Full name, email, and password are required.', 400);
  }

  if (fullName.trim().length < 3) {
    throw new AppError('Full name must be at least 3 characters.', 400);
  }

  // Basic email format check. For production, consider using a library
  // like `validator.js` for more thorough email validation.
  if (!/\S+@\S+\.\S+/.test(email)) {
    throw new AppError('Please provide a valid email address.', 400);
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }
}

/**
 * Validate the login request body.
 * Throws AppError (400) if email or password is missing.
 */
function validateLoginBody(body) {
  const { email, password } = body;

  if (!email || !password) {
    throw new AppError('Email and password are required.', 400);
  }
}

// ── Route Handlers ──────────────────────────────────────────────────
// Each handler is wrapped in asyncHandler() — a utility that catches
// any async errors and forwards them to the global error handler.
// Without it, unhandled Promise rejections would crash the server.

/**
 * POST /api/v1/auth/register
 *
 * Request body: { fullName, email, password }
 * Response: 201 Created + { user, token }
 *
 * The user is immediately logged in after registration (a JWT token
 * is returned), so the mobile app doesn't need to show a login screen.
 */
const register = asyncHandler(async (req, res) => {
  validateRegisterBody(req.body);

  const authData = await registerUser(req.body);

  return sendCreated(res, 'Account created successfully.', authData);
});

/**
 * POST /api/v1/auth/login
 *
 * Request body: { email, password }
 * Response: 200 OK + { user, token }
 *
 * The mobile app should save the token to SecureStore and include it
 * in all future requests as: Authorization: Bearer <token>
 */
const login = asyncHandler(async (req, res) => {
  validateLoginBody(req.body);

  const authData = await loginUser(req.body);

  return sendSuccess(res, 'Logged in successfully.', authData);
});

/**
 * GET /api/v1/auth/me
 *
 * Protected route — requires a valid JWT token.
 * The `protect` middleware runs before this handler and attaches
 * the verified user to `req.user`.
 *
 * Response: 200 OK + { user }
 *
 * The mobile app calls this on startup to verify the stored token
 * is still valid. If it returns 401, the app clears the token and
 * shows the login screen.
 */
const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, 'Profile fetched successfully.', {
    user: req.user,
  });
});

/**
 * PATCH /api/v1/auth/profile
 *
 * Protected route. Update the logged-in user's profile.
 * Only the fields provided in the body are updated.
 *
 * Request body (all optional): { fullName, location, language, phoneNumber }
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, location, language, phoneNumber } = req.body;

  const user = await updateUserProfile(req.user.id, {
    fullName,
    location,
    language,
    phoneNumber,
  });

  return sendSuccess(res, 'Profile updated successfully.', { user });
});

/**
 * PATCH /api/v1/auth/password
 *
 * Protected route. Change the logged-in user's password.
 * Requires the current password for security.
 *
 * Request body: { currentPassword, newPassword }
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required.', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters.', 400);
  }

  if (currentPassword === newPassword) {
    throw new AppError('New password must be different from current password.', 400);
  }

  await changeUserPassword(req.user.id, currentPassword, newPassword);

  return sendSuccess(res, 'Password changed successfully.');
});

module.exports = {
  getMe,
  login,
  register,
  updateProfile,
  changePassword,
};
