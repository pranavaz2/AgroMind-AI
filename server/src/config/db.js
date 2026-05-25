/**
 * Database Configuration (Prisma + PostgreSQL)
 * ─────────────────────────────────────────────
 * This file creates and exports the Prisma Client — the single instance
 * used by ALL services to interact with the PostgreSQL database.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    HOW PRISMA CONNECTS                              │
 * │                                                                     │
 * │    Your Code                                                        │
 * │       │                                                             │
 * │       ▼                                                             │
 * │    PrismaClient  ← JavaScript API (findMany, create, update, etc.) │
 * │       │                                                             │
 * │       ▼                                                             │
 * │    PrismaPg Adapter  ← Translates Prisma queries to PostgreSQL SQL │
 * │       │                                                             │
 * │       ▼                                                             │
 * │    PostgreSQL Database  ← The actual data storage                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Why use the PrismaPg adapter?
 *   Prisma supports two connection modes:
 *     1. Built-in driver (default) — Prisma manages the connection pool.
 *     2. Driver adapter (what we use) — We provide the pg driver.
 *
 *   The adapter approach gives us more control over the PostgreSQL
 *   connection and is required for serverless deployments (Vercel, etc.)
 *   and edge runtimes.
 *
 * Important: There should only be ONE PrismaClient instance per app.
 *   Creating multiple instances creates multiple connection pools, which
 *   can exhaust the database's connection limit. We create it once here
 *   and import it everywhere via: const { prisma } = require('./config/db');
 */

const { PrismaClient } = require('../../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const env = require('./env');

// ── Create the PostgreSQL adapter ────────────────────────────────────
// PrismaPg uses the `pg` npm package internally to manage a connection
// pool. A connection pool keeps several database connections open and
// reuses them — much faster than opening a new connection per query.
const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
});

// ── Create the Prisma Client ─────────────────────────────────────────
// The log option controls what Prisma prints to the console:
//   'error' → Log database errors (always needed)
//   'warn'  → Log deprecation warnings and potential issues
//   'query' → Log every SQL query (useful for debugging, noisy in production)
//   'info'  → Log connection events
const prisma = new PrismaClient({
  adapter,
  log: env.isProduction
    ? ['error']                    // Production: only errors
    : ['error', 'warn'],           // Development: errors + warnings
});

/**
 * Connect to the database.
 * Called once during server startup (in server.js).
 *
 * $connect() establishes the connection pool and verifies that PostgreSQL
 * is reachable. If the database is down, this throws an error and the
 * server refuses to start (fail-fast behavior).
 */
async function connectDatabase() {
  await prisma.$connect();
  console.log('🗄️  PostgreSQL connected through Prisma');
}

/**
 * Disconnect from the database.
 * Called during graceful shutdown (in server.js).
 *
 * $disconnect() closes all connections in the pool. Without this,
 * open connections would "leak" and eventually hit PostgreSQL's
 * max_connections limit, blocking new connections.
 */
async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
};
