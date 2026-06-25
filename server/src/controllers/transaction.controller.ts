import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db.js';
import { postTransaction, reverseTransaction } from '../services/transaction.services.js';
import { log } from '../services/audit.services.js';
import { createTransactionSchema, reverseTransactionSchema } from '../validators/index.js';
import { v4 as uuidv4 } from 'uuid';

// POST /api/transactions
export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, entries, metadata } = createTransactionSchema.parse(req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const userId = req.user!.id;
    const ipAddress = req.ip || '127.0.0.1';
    
    const accountIds = [...new Set(entries.map((e) => e.accountId))];
    const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: ownedAccounts } = await pool.query(
      `SELECT id FROM accounts WHERE id IN (${placeholders}) AND (user_id = $${accountIds.length + 1} OR is_system = true)`,
      [...accountIds, userId],
    );

    if (ownedAccounts.length !== accountIds.length) {
      res.status(403).json({ error: 'One or more accounts do not belong to you' });
      return;
    }

    // Map API shape to service shape
    const ledgerEntries = entries.map((e) => ({
      account_id: e.accountId,
      entry_type: e.type as 'DEBIT' | 'CREDIT',
      amount: String(e.amount),
    }));

    const { transaction, entries: insertedEntries } = await postTransaction(
      idempotencyKey,
      { ...metadata, description, created_by: userId },
      ledgerEntries,
      userId,
    );

    await log({
      entity_type: 'transaction',
      entity_id: transaction.id,
      action: 'TRANSACTION_POSTED',
      new_data: { description, entries: ledgerEntries } as any,
      ip_address: ipAddress,
    });

    res.status(201).json({
      transaction: {
        ...transaction,
        entries: insertedEntries.map((e) => ({ ...e, amount: e.amount.toString() })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/transactions/:transactionId
export const getTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user!.id;

    const { rows: txRows } = await pool.query(
      `SELECT * FROM transactions WHERE id = $1 AND (created_by = $2 OR $2 IN (
         SELECT user_id FROM accounts a
         JOIN ledger_entries le ON le.account_id = a.id
         WHERE le.transaction_id = $1
       ))`,
      [transactionId as string, userId],
    );

    if (txRows.length === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const { rows: entryRows } = await pool.query(
      `SELECT * FROM ledger_entries WHERE transaction_id = $1`,
      [transactionId],
    );

    res.status(200).json({
      transaction: {
        ...txRows[0],
        entries: entryRows.map((e) => ({ ...e, amount: e.amount.toString() })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/transactions/:transactionId/reverse
export const reverseTransactionController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;
    const { reason } = reverseTransactionSchema.parse(req.body);
    const userId = req.user!.id;
    const ipAddress = req.ip || '127.0.0.1';

    // Ownership check
    const { rows: txRows } = await pool.query(
      `SELECT * FROM transactions WHERE id = $1`,
      [transactionId],
    );
    if (txRows.length === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Generate new idempotency key for the reversal
    const reversalIdempotencyKey = uuidv4();

    const { transaction, entries } = await reverseTransaction(
      transactionId as string,
      reversalIdempotencyKey,
      ipAddress,
      userId,
      reason,
    );

    res.status(201).json({
      transaction: {
        ...transaction,
        entries: entries.map((e) => ({ ...e, amount: e.amount.toString() })),
      },
    });
  } catch (err) {
    next(err);
  }
};
