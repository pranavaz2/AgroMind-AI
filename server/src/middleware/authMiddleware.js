/**
 * Authentication Middleware (Route Protection)
 * ────────────────────────────────────────────
 * This middleware protects routes that require a logged-in user.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    HOW PROTECTED ROUTES WORK                       │
 * │                                                                     │
 * │  Unprotected route (anyone can access):                            │
 * │    router.post('/login', login);                                    │
 * │                                                                     │
 * │  Protected route (logged-in users only):                           │
 * │    router.get('/me', protect, getMe);                              │
 * │                      ↑                                              │
 * │              runs BEFORE getMe                                      │
 * │                                                                     │
 * │  What `protect` does:                                               │
 * │    1. Check: Is there an "Authorization: Bearer <token>" header?   │
 * │       → No  → 401 "Token is required"                             │
 * │    2. Extract the token string after "Bearer "                     │
 * │    3. Verify the token's signature with JWT_SECRET                 │
 * │       → Invalid/expired → 401 "Invalid token"                     │
 * │    4. Decode the userId from the token payload                     │
 * │    5. Query the database: does this user still exist?              │
 * │       → Deleted → 401 "User no longer exists"                     │
 * │    6. Attach the user object to req.user                           │
 * │    7. Call next() → the controller runs with req.user available    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Why check the database in step 5?
 *   A JWT token is valid until it expires (7 days). If an admin deletes
 *   or suspends a user during that time, the token is still cryptographically
 *   valid. By checking the database, we ensure deleted/suspended users
 *   are immediately locked out — not after 7 days.
 */

const { prisma } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');

const protect = asyncHandler(async (req, res, next) => {
  // Step 1: Check for the Authorization header.
  // Format: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication token is required.', 401);
  }

  // Step 2: Extract the token (everything after "Bearer ").
  const token = authHeader.split(' ')[1];

  // Step 3: Verify the token's signature and check expiration.
  // If invalid → jwt.verify() throws → asyncHandler catches → 401.
  const decoded = verifyToken(token);

  // Step 4-5: Look up the user in the database.
  // We select only the fields the app needs — never passwordHash.
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      location: true,
      language: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('The user for this token no longer exists.', 401);
  }

  // Step 6: Attach the user to the request object.
  // All downstream controllers can now access req.user.
  req.user = user;

  // Step 7: Pass control to the next middleware/controller.
  next();
});

module.exports = {
  protect,
};
