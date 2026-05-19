/**
 * Optional Auth Middleware
 * ─────────────────────────
 * This middleware allows routes to be used publicly (MVP mode)
 * without breaking the Prisma schema that requires a userId.
 * 
 * Flow:
 * 1. If a JWT token is present, it decodes it and attaches req.user (normal auth).
 * 2. If NO token is present, it assigns a fallback "MVP_USER_ID" to req.user.
 *    This allows the scan to be saved to the database under the public MVP user.
 */

const { verifyToken } = require('../utils/jwt');
const { prisma } = require('../config/db');

// The UUID we will use for all unauthenticated public scans.
// This matches the UUID we seed in server.js.
const MVP_USER_ID = '00000000-0000-0000-0000-000000000000';

exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check if Authorization header exists and starts with "Bearer "
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      // MVP BYPASS: No token provided. Assign the public MVP user.
      req.user = { id: MVP_USER_ID };
      return next();
    }

    // A token was provided, so verify it normally.
    const decoded = verifyToken(token);

    // Ensure the user actually exists in the database
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, status: true },
    });

    if (!currentUser || currentUser.status !== 'ACTIVE') {
      // Token is valid, but user is deleted/suspended.
      // Fallback to MVP user so the request doesn't fail for the public app.
      req.user = { id: MVP_USER_ID };
      return next();
    }

    // Attach the real authenticated user to the request
    req.user = currentUser;
    next();
  } catch (error) {
    // If token verification fails (expired/tampered), fallback to MVP user.
    console.warn('OptionalAuth: Token verification failed, falling back to MVP user.', error.message);
    req.user = { id: MVP_USER_ID };
    next();
  }
};
