import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { getBalance } from '../services/balance.services.js';
import { pool } from '../config/db.js';

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication on handshake invalid token disconnects immediately
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, env.jwt.secret) as { userId: string; email: string };
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] Client connected: ${socket.id} (user: ${socket.data.userId})`);

    // Subscribe to an account's balance feed
    socket.on('subscribe_account', async ({ accountId }: { accountId: string }) => {
      try {

        const { rows } = await pool.query(
          `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
          [accountId, socket.data.userId],
        );

        if (rows.length === 0) {
          socket.emit('error', { message: 'Account not found or access denied' });
          return;
        }

        socket.join(`account:${accountId}`);
        console.log(`[socket] ${socket.data.userId} subscribed to account:${accountId}`);

        // Send current balance immediately as snapshot
        const balance = await getBalance(accountId);
        socket.emit('balance_snapshot', {
          accountId,
          balance: balance.toString(),
        });
      } catch (err) {
        console.error('[socket] subscribe_account error:', err);
        socket.emit('error', { message: 'Failed to subscribe to account' });
      }
    });

    // Unsubscribe from an account
    socket.on('unsubscribe_account', ({ accountId }: { accountId: string }) => {
      socket.leave(`account:${accountId}`);
      console.log(`[socket] ${socket.data.userId} unsubscribed from account:${accountId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  // Redis Pub/Sub subscriber separate client (Redis requirement)
  // A subscribed Redis client cannot execute other commands
  const redisSub = new IORedis(env.redisUrl);

  redisSub.on('error', (err) => {
    console.error('[socket/redis-sub] Error:', err);
  });

  redisSub.subscribe('balance_updates', (err) => {
    if (err) {
      console.error('[socket/redis-sub] Failed to subscribe to balance_updates:', err);
      return;
    }
    console.log('[socket/redis-sub] Subscribed to balance_updates channel');
  });

  redisSub.on('message', (_channel, message) => {
    try {
      const payload = JSON.parse(message) as {
        accountId: string;
        balance: string;
        transactionId: string;
        timestamp: string;
      };
      // Broadcast to all clients in the account room
      io.to(`account:${payload.accountId}`).emit('balance_updated', payload);
    } catch (err) {
      console.error('[socket/redis-sub] Failed to parse message:', err);
    }
  });

  return io;
};

export { io };
