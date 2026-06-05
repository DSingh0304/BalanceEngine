const { Pool } = require("pg");
const env = require('./env');

// Database connection pool setup
const pool = new Pool({
  host: env.db.host,
  port: parseInt(String(env.db.port || "5432"), 10),
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = { pool };

// Verify database connectivity on startup
const testDatabaseConnection = async () => {
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
};

testDatabaseConnection();