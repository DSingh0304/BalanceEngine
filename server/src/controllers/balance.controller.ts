import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db.js';
import { getBalance } from '../services/balance.services.js';

// GET /api/accounts/:accountId/balance
export const getAccountBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.id;

    // Ownership check
    const { rows } = await pool.query(
      `SELECT id, currency FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const account = rows[0];
    const balance = await getBalance(accountId as string);
    const balanceNumber = Number(balance);

    // Format using Intl.NumberFormat
    const balanceDisplay = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balanceNumber / 100);

    res.status(200).json({
      balance: balance.toString(),
      balance_display: balanceDisplay,
      currency: account.currency,
      as_of: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};
