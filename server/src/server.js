/**
 * Server Entry Point
 * ──────────────────
 * This file starts the HTTP server and connects to the database.
 * It is the FIRST file that runs when you type `npm run dev`.
 *
 * Why separate server.js from app.js?
 * ───────────────────────────────────
 *   app.js  → Configures Express (middleware, routes, error handlers)
 *   server.js → Starts listening on a port + connects to the database
 *
 *   This separation is an industry best practice because:
 *     1. You can import app.js in tests without starting a real server
 *     2. server.js handles infrastructure (port, DB, shutdown)
 *     3. app.js handles application logic (routes, middleware)
 *
 * Server lifecycle:
 * ─────────────────
 *   1. Connect to PostgreSQL via Prisma
 *   2. Start HTTP server on PORT (default: 5000)
 *   3. Listen for requests...
 *   4. On SIGINT/SIGTERM → graceful shutdown
 *      - Stop accepting new requests
 *      - Wait for in-flight requests to complete
 *      - Close database connection
 *      - Exit process
 */

const app = require('./app');
const env = require('./config/env');
const { prisma, connectDatabase, disconnectDatabase } = require('./config/db');
const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');

// The UUID used for all unauthenticated public scans
const MVP_USER_ID = '00000000-0000-0000-0000-000000000000';

async function seedMvpUser() {
  try {
    const existing = await prisma.user.findUnique({ where: { id: MVP_USER_ID } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id: MVP_USER_ID,
          fullName: 'Public MVP User',
          email: 'mvp@agromind.local',
          passwordHash: 'MVP_NO_LOGIN',
          role: 'FARMER',
        },
      });
      console.log('✅ Public MVP User seeded successfully.');
    }
  } catch (error) {
    console.error('⚠️ Could not seed MVP user:', error.message);
  }
}

let server;

async function startServer() {
  try {
    // Step 1: Connect to the database BEFORE accepting HTTP requests.
    // If the database is unreachable, the server won't start — this is
    // "fail-fast" behavior. Better to crash on startup than to accept
    // requests that will all fail with database errors.
    await connectDatabase();
    await seedMvpUser();
    startNotificationScheduler();

    // Step 2: Start listening for HTTP requests.
    server = app.listen(env.port, () => {
      console.log(`\n🌱 AgroMind AI API running on port ${env.port}`);
      console.log(`   Environment: ${env.nodeEnv}`);
      console.log(`   Health check: http://localhost:${env.port}/api/v1/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// ── Graceful Shutdown ──────────────────────────────────────────────────
//
// What is graceful shutdown?
//   When the server receives a stop signal (Ctrl+C, or a deploy restart),
//   it doesn't immediately kill all connections. Instead:
//     1. Stop accepting NEW requests
//     2. Wait for EXISTING requests to finish (up to a timeout)
//     3. Close the database connection cleanly
//     4. Exit the process
//
// Why does this matter?
//   Without graceful shutdown, a user in the middle of uploading a scan
//   image would get a broken connection. With it, their request completes
//   before the server shuts down.
//
// SIGINT  = Ctrl+C in the terminal
// SIGTERM = Signal sent by hosting platforms (Render, Railway, etc.) during deploys

async function shutdown(signal) {
  console.log(`\n⏳ Received ${signal}. Shutting down gracefully...`);

  if (server) {
    // Stop accepting new connections.
    server.close(() => {
      console.log('   HTTP server closed.');
    });
  }

  stopNotificationScheduler();

  // Close the Prisma database connection pool.
  await disconnectDatabase();
  console.log('   Database disconnected.');
  console.log('   Goodbye! 🌿\n');

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Handle uncaught errors ────────────────────────────────────────────
//
// These catch errors that happen OUTSIDE of Express routes:
//   - A forgotten await on a Promise
//   - A null reference in a setTimeout callback
//   - A bug in a third-party library
//
// In production, these should log to an error tracking service (like
// Sentry) before crashing. For now, we log and exit.

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  shutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Must exit — the process is in an undefined state after uncaughtException.
  process.exit(1);
});

startServer();
