/**
 * JWT Utility Functions
 * ─────────────────────
 * JWT (JSON Web Token) is how we authenticate users WITHOUT server-side sessions.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    HOW JWT AUTHENTICATION WORKS                     │
 * │                                                                     │
 * │  Traditional sessions (NOT what we use):                           │
 * │    1. User logs in                                                  │
 * │    2. Server creates a session and stores it in memory/database    │
 * │    3. Server sends a session ID cookie to the browser              │
 * │    4. Browser sends cookie with every request                      │
 * │    5. Server looks up the session to verify the user               │
 * │    ❌ Problem: Server must store ALL active sessions               │
 * │                                                                     │
 * │  JWT (what we use):                                                 │
 * │    1. User logs in                                                  │
 * │    2. Server creates a JWT token (signed with a secret key)        │
 * │    3. Server sends the token to the mobile app                     │
 * │    4. App stores it in SecureStore (encrypted on-device storage)   │
 * │    5. App sends token in the "Authorization" header                │
 * │    6. Server verifies the signature — no database lookup needed    │
 * │    ✅ Stateless: Server stores NOTHING about active sessions       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * What's inside a JWT token?
 * ──────────────────────────
 *   A JWT has 3 parts separated by dots: HEADER.PAYLOAD.SIGNATURE
 *
 *   Header:    { "alg": "HS256", "typ": "JWT" }
 *              → Tells the server which algorithm was used to sign
 *
 *   Payload:   { "userId": "abc-123", "iat": 1699999999, "exp": 1700604799 }
 *              → The data we store (userId, issued-at, expiration)
 *              → ⚠️ This is base64-encoded, NOT encrypted!
 *              → NEVER put passwords, credit cards, or secrets here.
 *
 *   Signature: HMAC-SHA256(header + "." + payload, JWT_SECRET)
 *              → Proves the token wasn't tampered with.
 *              → Only our server knows the JWT_SECRET, so only our
 *                server can create valid signatures.
 *
 * Security rules:
 *   1. JWT_SECRET must be long and random (minimum 32 characters)
 *   2. NEVER put sensitive data in the payload (it's readable by anyone)
 *   3. Always set an expiration (we use 7 days by default)
 *   4. Use HTTPS in production (tokens can be intercepted over HTTP)
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Create a new JWT token.
 *
 * @param {Object} payload - Data to embed in the token.
 *   Example: { userId: "abc-123-def-456" }
 *
 * @returns {string} The signed JWT token string.
 *
 * What does jwt.sign() do?
 *   1. Takes the payload (e.g., { userId: "..." })
 *   2. Adds metadata: iat (issued-at timestamp), exp (expiration)
 *   3. Creates a signature using HMAC-SHA256 + your JWT_SECRET
 *   4. Returns: "eyJhbG...header.eyJ1c2...payload.SflK...signature"
 */
function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn, // Default: '7d' (7 days)
  });
}

/**
 * Verify and decode a JWT token.
 *
 * @param {string} token - The JWT string from the Authorization header.
 * @returns {Object} The decoded payload (e.g., { userId, iat, exp }).
 * @throws {JsonWebTokenError} If the token is invalid or expired.
 *
 * What does jwt.verify() do?
 *   1. Splits the token into header, payload, and signature
 *   2. Recalculates the signature using JWT_SECRET
 *   3. Compares the calculated signature with the token's signature
 *   4. If they match → the token is authentic (not tampered with)
 *   5. Checks the exp (expiration) — rejects expired tokens
 *   6. Returns the decoded payload
 *
 * If verification fails (wrong secret, expired, tampered):
 *   Throws an error → caught by authMiddleware → returns 401
 */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  signToken,
  verifyToken,
};
