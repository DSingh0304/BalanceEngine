import { Pool } from 'pg';
import env from './env.js';

// Database connection pool setup
export const pool = new Pool({
  host: env.db.host,
  port: parseInt(String(env.db.port || "5432"), 10),
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});


// Verify database connectivity on startup
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT NOW()");
      console.log("PostgreSQL connected successfully at:", result.rows[0].now);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("FATAL: PostgreSQL connection failed on startup:", err);
    process.exit(1);
  }
}

testDatabaseConnection();