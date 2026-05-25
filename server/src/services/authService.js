/**
 * Auth Service — Business Logic for Authentication
 * ─────────────────────────────────────────────────
 * This service handles the REAL work of authentication:
 *   - Creating new user accounts (registration)
 *   - Verifying credentials (login)
 *   - Password hashing with bcrypt
 *   - Token generation
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    PASSWORD SECURITY WITH BCRYPT                    │
 * │                                                                     │
 * │  Why not store passwords as plain text?                            │
 * │    If your database is hacked, the attacker gets EVERY password.   │
 * │    Users reuse passwords across sites → their bank, email, social  │
 * │    media accounts are all compromised.                              │
 * │                                                                     │
 * │  Why not use MD5 or SHA-256?                                       │
 * │    These are FAST hash functions. An attacker with a GPU can try   │
 * │    billions of passwords per second until they find a match.       │
 * │                                                                     │
 * │  Why bcrypt?                                                        │
 * │    bcrypt is intentionally SLOW. Each hash takes ~250ms.           │
 * │    This makes brute-force attacks impractical:                     │
 * │      - MD5: 10 billion guesses/second → instant                   │
 * │      - bcrypt (12 rounds): 4 guesses/second → centuries           │
 * │                                                                     │
 * │  What is "salt"?                                                    │
 * │    A random string added to the password before hashing.           │
 * │    Two users with password "abc123" get DIFFERENT hashes.          │
 * │    bcrypt generates a unique salt automatically (built-in).        │
 * │                                                                     │
 * │  What does "12 rounds" mean?                                       │
 * │    bcrypt runs the hash function 2^12 = 4096 times.               │
 * │    More rounds = slower = more secure, but costs more CPU.         │
 * │    12 rounds is the industry standard (takes ~250ms per hash).     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Why is this a "service" and not in the controller?
 *   The controller handles HTTP concerns (req, res, status codes).
 *   The service handles business logic (hashing, DB queries, validation).
 *   This separation means:
 *     ✅ You can call registerUser() from a CLI script, test, or another service
 *     ✅ The controller stays small and focused on HTTP
 *     ✅ Business rules are in one place, not scattered across routes
 */

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');

// ── Salt rounds for bcrypt ──────────────────────────────────────────
// Higher = slower = more secure. 12 is the standard.
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Remove sensitive fields before sending user data to the client.
 *
 * Why? The Prisma User object includes `passwordHash`. If we accidentally
 * send it to the mobile app, the hash is exposed. Even though bcrypt hashes
 * can't be easily reversed, it's a security best practice to NEVER return
 * password data in API responses.
 */
function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Register a new user account.
 *
 * Flow:
 *   1. Normalize email (trim + lowercase)
 *   2. Check if email already exists (prevent duplicates)
 *   3. Hash the password with bcrypt (12 rounds)
 *   4. Create the user in PostgreSQL
 *   5. Generate a JWT token
 *   6. Return the user (without passwordHash) + token
 *
 * @param {Object} params
 * @param {string} params.fullName  - User's display name
 * @param {string} params.email     - User's email address
 * @param {string} params.password  - Plain text password (will be hashed)
 * @returns {Promise<{user: Object, token: string}>}
 */
async function registerUser({ fullName, email, password }) {
  // Normalize email: "  Farmer@Gmail.COM  " → "farmer@gmail.com"
  const normalizedEmail = email.trim().toLowerCase();

  // Check if this email is already registered.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409);
  }

  // Hash the password. bcrypt automatically generates a unique salt.
  // The result looks like: "$2a$12$LJ3m4ys5Gk.../hashed..."
  //   $2a$ = bcrypt version
  //   12$  = number of rounds
  //   rest = salt + hash combined
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Create the user in the database.
  const user = await prisma.user.create({
    data: {
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash: hashedPassword,
    },
  });

  // Generate a JWT token so the user is immediately logged in
  // after registration (no need to log in separately).
  const token = signToken({ userId: user.id });

  return {
    user: sanitizeUser(user),
    token,
  };
}

/**
 * Log in an existing user.
 *
 * Flow:
 *   1. Normalize email
 *   2. Find user by email
 *   3. Compare plain password with stored bcrypt hash
 *   4. Update lastLoginAt timestamp
 *   5. Generate a JWT token
 *   6. Return the user (without passwordHash) + token
 *
 * Security: We use the SAME error message for "email not found" and
 * "wrong password". This prevents attackers from discovering which
 * emails are registered (email enumeration attack).
 *
 * @param {Object} params
 * @param {string} params.email    - User's email address
 * @param {string} params.password - Plain text password to verify
 * @returns {Promise<{user: Object, token: string}>}
 */
async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // ⚠️ Same message for both "user not found" and "wrong password"
  // to prevent email enumeration attacks.
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  // bcrypt.compare() takes the plain password and the stored hash,
  // extracts the salt from the hash, re-hashes the plain password
  // with that salt, and checks if the results match.
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = signToken({ userId: user.id });

  // Track when the user last logged in (useful for analytics and
  // detecting inactive accounts).
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    user: sanitizeUser(updatedUser),
    token,
  };
}

/**
 * Update the logged-in user's profile.
 * Only updates the fields that are provided — other fields stay unchanged.
 *
 * @param {string} userId   - The logged-in user's ID
 * @param {Object} updates  - Fields to update
 * @returns {Promise<Object>} The updated user (sanitized)
 */
async function updateUserProfile(userId, updates) {
  const data = {};

  if (updates.fullName !== undefined) {
    if (updates.fullName.trim().length < 3) {
      throw new AppError('Full name must be at least 3 characters.', 400);
    }
    data.fullName = updates.fullName.trim();
  }

  if (updates.location !== undefined) {
    data.location = updates.location?.trim() || null;
  }

  if (updates.language !== undefined) {
    const validLanguages = ['ENGLISH', 'HINDI', 'MARATHI', 'TELUGU', 'TAMIL', 'KANNADA'];
    if (!validLanguages.includes(updates.language)) {
      throw new AppError(`Language must be one of: ${validLanguages.join(', ')}`, 400);
    }
    data.language = updates.language;
  }

  if (updates.phoneNumber !== undefined) {
    data.phoneNumber = updates.phoneNumber?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No fields to update.', 400);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return sanitizeUser(user);
}

/**
 * Change the logged-in user's password.
 * Requires the current password for verification (prevents someone
 * who steals a phone from changing the password without knowing it).
 *
 * @param {string} userId          - The logged-in user's ID
 * @param {string} currentPassword - The user's current password
 * @param {string} newPassword     - The new password to set
 * @returns {Promise<Object>} The updated user (sanitized)
 */
async function changeUserPassword(userId, currentPassword, newPassword) {
  // Get the user with their passwordHash (we need it for comparison).
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // Verify the current password is correct.
  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isCurrentValid) {
    throw new AppError('Current password is incorrect.', 401);
  }

  // Hash the new password and save it.
  const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedNewPassword },
  });

  return sanitizeUser(updatedUser);
}

module.exports = {
  loginUser,
  registerUser,
  sanitizeUser,
  updateUserProfile,
  changeUserPassword,
};
