const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined
});

async function run() {
  try {
    await client.connect();
    console.log("=== DB SCHEMA DIAGNOSTIC ===");
    
    // 1. List all tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Tables in DB:", tablesRes.rows.map(r => r.table_name));

    // 2. List all user-defined types (enums)
    const typesRes = await client.query(`
      SELECT t.typname as type_name, string_agg(e.enumlabel, ', ') as enum_values
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      GROUP BY t.typname;
    `);
    console.log("Enums in DB:");
    typesRes.rows.forEach(r => {
      console.log(`- ${r.type_name}: [${r.enum_values}]`);
    });

    // 3. List prisma migrations history
    const migrationsRes = await client.query(`
      SELECT id, migration_name, rolled_back_at, started_at, finished_at 
      FROM _prisma_migrations 
      ORDER BY started_at;
    `);
    console.log("Prisma migrations history:");
    migrationsRes.rows.forEach(r => {
      console.log(`- ${r.migration_name}: started_at=${r.started_at}, finished_at=${r.finished_at || 'FAILED/IN_PROGRESS'}`);
    });

  } catch (err) {
    console.error("Diagnostic error:", err);
  } finally {
    await client.end();
  }
}

run();
