import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db.js';
import { getBalance } from '../services/balance.services.js';
import { log } from '../services/audit.services.js';
import { createAccountSchema } from '../validators/index.js';

// POST /api/accounts
export const createAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, currency } = createAccountSchema.parse(req.body);
    const userId = req.user!.id;
    const ipAddress = req.ip || '127.0.0.1';

    const { rows } = await pool.query(
      `INSERT INTO accounts (user_id, name, type, currency)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, type, currency, is_system, created_at`,
      [userId, name, type, currency],
    );

    const account = rows[0];

    await log({
      entity_type: 'account',
      entity_id: account.id,
      action: 'ACCOUNT_CREATED',
      new_data: { name, type, currency, user_id: userId },
      ip_address: ipAddress,
    });

    res.status(201).json({
      account: { ...account, balance: 0 },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/accounts
export const getAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const { rows } = await pool.query(
      `SELECT id, user_id, name, type, currency, is_system, created_at
       FROM accounts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    );

    // Fetch balances for all accounts in parallel
    const accountsWithBalances = await Promise.all(
      rows.map(async (account) => {
        const balance = await getBalance(account.id as string);
        return { ...account, balance: balance.toString() };
      }),
    );

    res.status(200).json({ accounts: accountsWithBalances });
  } catch (err) {
    next(err);
  }
};

// GET /api/accounts/:accountId
export const getAccountById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.id;

    const { rows } = await pool.query(
      `SELECT id, user_id, name, type, currency, is_system, created_at
       FROM accounts
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const account = rows[0];
    const balance = await getBalance(accountId as string);

    res.status(200).json({ account: { ...account, balance: balance.toString() } });
  } catch (err) {
    next(err);
  }
};

// GET /api/accounts/:accountId/entries - cursor-based pagination with running balance
export const getAccountEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.id;
    const limitParam = parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);
    const before = req.query.before as string | undefined;

    // Ownership check
    const { rows: accountRows } = await pool.query(
      `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId],
    );
    if (accountRows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // Running balance via window function
    let queryText: string;
    let queryParams: any[];

    const windowSql = `
      SELECT
        le.id,
        le.transaction_id,
        le.account_id,
        le.entry_type,
        le.amount,
        le.created_at,
        t.description,
        t.status AS transaction_status,
        t.metadata,
        SUM(
          CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE -le.amount END
        ) OVER (
          PARTITION BY le.account_id
          ORDER BY le.created_at ASC, le.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_balance
      FROM ledger_entries le
      JOIN transactions t ON le.transaction_id = t.id
      WHERE le.account_id = $1
    `;

    if (before) {
      // before is a base64 encoded JSON: { createdAt, id }
      let cursorData: { createdAt: string; id: string };
      try {
        cursorData = JSON.parse(Buffer.from(before, 'base64').toString('utf-8'));
      } catch {
        res.status(400).json({ error: 'Invalid cursor' });
        return;
      }

      queryText = `
        SELECT * FROM (${windowSql}) sub
        WHERE (sub.created_at, sub.id) < ($2::timestamptz, $3::uuid)
        ORDER BY sub.created_at DESC, sub.id DESC
        LIMIT $4
      `;
      queryParams = [accountId, cursorData.createdAt, cursorData.id, limit];
    } else {
      queryText = `
        SELECT * FROM (${windowSql}) sub
        ORDER BY sub.created_at DESC, sub.id DESC
        LIMIT $2
      `;
      queryParams = [accountId, limit];
    }

    const { rows } = await pool.query(queryText, queryParams);

    const entries = rows.map((r) => ({
      ...r,
      amount: r.amount.toString(),
      running_balance: r.running_balance.toString(),
    }));

    let nextCursor: string | null = null;
    if (rows.length === limit) {
      const last = rows[rows.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.created_at, id: last.id }),
      ).toString('base64');
    }

    res.status(200).json({ entries, nextCursor });
  } catch (err) {
    next(err);
  }
};

// GET /api/accounts/:accountId/audit
export const getAccountAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.id;

    // Ownership check
    const { rows: accountRows } = await pool.query(
      `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId],
    );
    if (accountRows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, action, entity_type, entity_id, old_data, new_data, ip_address, created_at
       FROM audit_log
       WHERE entity_type = 'account' AND entity_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [accountId],
    );

    res.status(200).json({ events: rows });
  } catch (err) {
    next(err);
  }
};
