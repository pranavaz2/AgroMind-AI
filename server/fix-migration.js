const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in environment.");
  process.exit(1);
}

console.log("Connecting to database to fix migration lock...");
const client = new Client({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined
});

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected. Deleting failed migration record...");
    const res = await client.query(`
      DELETE FROM _prisma_migrations 
      WHERE finished_at IS NULL;
    `);
    console.log(`Deleted ${res.rowCount} row(s) from _prisma_migrations.`);
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

run();
