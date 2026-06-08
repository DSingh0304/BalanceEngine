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
	try{
    await pool.query('SELECT 1');
    await redis.ping();

    res.status(200).json({
      status: 'ok',
      message: 'LedgerFlow API is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error){
    console.error('Health check failed:', error);
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

    await redis.ping();
    await redisSub.ping();
    console.log('Redis clients (Main & Sub) established.');
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
