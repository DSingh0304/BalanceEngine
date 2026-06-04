const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = { pool };

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