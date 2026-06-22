import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

// Custom application error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// PostgreSQL error codes
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_CHECK_VIOLATION = '23514';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  // Our own AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // PostgreSQL driver errors
  if (err.code === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: 'Resource already exists (duplicate key)' });
    return;
  }
  if (err.code === PG_FOREIGN_KEY_VIOLATION) {
    res.status(400).json({ error: 'Referenced resource does not exist' });
    return;
  }
  if (err.code === PG_NOT_NULL_VIOLATION) {
    res.status(400).json({ error: 'Required field is missing' });
    return;
  }
  if (err.code === PG_CHECK_VIOLATION) {
    res.status(400).json({ error: 'Value violates a database constraint' });
    return;
  }

  // Domain-level known errors (services throw plain Error with these messages)
  const msg: string = err?.message ?? '';
  if (msg.includes('Email is already registered')) {
    res.status(409).json({ error: msg });
    return;
  }
  if (msg.includes('Invalid Credentials')) {
    res.status(401).json({ error: msg });
    return;
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    res.status(404).json({ error: msg });
    return;
  }
  if (msg.includes('already reversed') || msg.includes('Entries do not balance') || msg.includes('Validation Error')) {
    res.status(400).json({ error: msg });
    return;
  }
  if (msg.includes('Duplicate') || msg.includes('duplicate')) {
    res.status(409).json({ error: msg });
    return;
  }

  // Unknown errors: log in dev, hide in production
  if (env.port && process.env.NODE_ENV !== 'production') {
    console.error('[errorHandler]', err);
  }

  res.status(500).json({ error: 'Internal server error' });
};
