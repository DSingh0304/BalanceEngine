import express = require("express");
import console = require("node:console");
import type { Request, Response } from "express";
const env = require("./config/env");
const { pool } = require("./config/db");
const { redis, redisSub } = require("./config/redis");

// Initialize express application
const app = express();

app.use(express.json());

app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Ensure database is reachable
    await pool.query('SELECT 1');

    // Check redis, but treat redis failure as non-fatal for health — include status
    let redisOk = true;
    try {
      await redis.ping();
    } catch (err) {
      redisOk = false;
      console.warn('Redis ping failed during health check:', err);
    }

    res.status(200).json({
      status: 'ok',
      message: 'LedgerFlow API is healthy',
      timestamp: new Date().toISOString(),
      redis: redisOk
    });
  } catch (error) {
    console.error('Health check failed (DB):', error);
    res.status(503).json({
      status: 'error',
      message: 'Service Unavailable'
    });
  }
});

const startServer = async () => {
  try{
    console.log('...Booting the server...');
    console.log('Environment variables validated.');

    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('PostgreSQL connection established.');

    // Redis is desirable but not required for startup. Attempt ping but continue on failure.
    try {
      await redis.ping();
      await redisSub.ping();
      console.log('Redis clients (Main & Sub) established.');
    } catch (err) {
      console.warn('Redis not available during startup — continuing without cache:', err);
    }
    const PORT = env.port || 3000;
    app.listen(PORT, () => {
      console.log(`Server successfully running on port ${PORT}`);
    })
  } catch (err) {
    console.error('CRITICAL: Failed to start server. Exiting process...', err);
    process.exit(1);
  }
};

startServer();
