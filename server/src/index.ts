import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import { pool } from './config/db.js';
import { redis } from './config/redis.js';
import { initSocket } from './socket/index.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
const httpServer = http.createServer(app);

// Security & Logging 
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body Parsing
app.use(express.json());

// Rate Limiting (auth endpoints only)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes 

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

// Health check

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    let redisOk = true;
    try {
      await redis.ping();
    } catch {
      redisOk = false;
    }
    res.status(200).json({
      status: 'ok',
      message: 'BalanceEngine API is healthy',
      timestamp: new Date().toISOString(),
      redis: redisOk,
    });
  } catch {
    res.status(503).json({ status: 'error', message: 'Service Unavailable' });
  }
});

// Global Error Handler 

app.use(errorHandler);

// Server Startup

const startServer = async () => {
  try {
    console.log('...Booting the server...');

    // Verify PostgreSQL
    
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('PostgreSQL connection established.');

    // Verify Redis (non-fatal)

    try {
      await redis.ping();
      console.log('Redis connected.');
    } catch (err) {
      console.warn('Redis not available during startup — continuing without cache:', err);
    }

    // Initialize Socket.io on the same HTTP server

    initSocket(httpServer);
    console.log('Socket.io initialized.');

    const PORT = env.port || 8080;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful Shutdown

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      httpServer.close(async () => {
        console.log('HTTP server closed.');
        await pool.end();
        console.log('PostgreSQL pool drained.');
        redis.disconnect();
        console.log('Redis disconnected.');
        process.exit(0);
      });

      // Force exit after 10 seconds

      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled rejections

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled promise rejection:', reason);
    });

  } catch (err) {
    console.error('CRITICAL: Failed to start server. Exiting.', err);
    process.exit(1);
  }
};

startServer();
