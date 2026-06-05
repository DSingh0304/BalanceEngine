const { pool } = require('../config/db')
const { redis } = require('../config/redis')
import type { Transaction, LedgerEntry } from "../types";

// Validate entries balance and amounts
const validateEntries = (entries: Partial<LedgerEntry>[]) => {
  if (entries.length < 2) {
    throw new Error(
      "Validation Error: A transaction must have atleast 2 entries.",
    );
  }
  let debitSum = 0n;
  let creditSum = 0n;

  for (const entry of entries) {
    if (!entry.amount || BigInt(entry.amount) <= 0n) {
      throw new Error(
        "Validation Error: All entry amounts must be greater than 0.",
      );
    }
    if (entry.entry_type === "DEBIT") {
      debitSum += BigInt(entry.amount);
    } else if (entry.entry_type === "CREDIT") {
      creditSum += BigInt(entry.amount);
    } else {
      throw new Error(
        "Validation Error: Invalid entry type. Must be DEBIT or CREDIT.",
      );
    }
  }
  if (debitSum !== creditSum) {
    throw new Error(
      `Validation Error: Entries do not balance. DEBITs: ${debitSum}, CREDITs: ${creditSum}`,
    );
  }
};

// Post transaction and ledger entries inside database transaction
const postTransaction = async (
  idempotencyKey: string,
  metadata: Record<string, any>,
  entries: Partial<LedgerEntry>[],
) => {
  validateEntries(entries);
  const accountIds = Array.from(new Set(entries.map((e) => e.account_id)));

  // Connect client and begin transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(`, `);
    // Lock accounts to prevent concurrent modifications
    const { rows: lockedAccounts } = await client.query(
      `SELECT id FROM accounts WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      accountIds,
    );
    if (lockedAccounts.length !== accountIds.length) {
      throw new Error("Transaction Failed: One or more accounts do not exist.");
    }

    // Insert the main transaction record
    const { rows: txRows } = await client.query(
      `INSERT INTO transactions (idempotency_key, metadata, status, description) VALUES ($1, $2, 'POSTED', $3) RETURNING *`, 
      [idempotencyKey, metadata, metadata.note || metadata.description || 'Transaction']
    );

    const transaction: Transaction = txRows[0];
    const insertedEntries = [];

    // Insert each associated ledger entry
    for (const entry of entries) {
      const { rows: entryRows } = await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type) VALUES ($1, $2, $3, $4) RETURNING *`, [transaction.id, entry.account_id, entry.amount, entry.entry_type]
      );
      insertedEntries.push(entryRows);
    }
    // Commit transaction and log success
    await client.query('COMMIT');

    try {
      console.log(`Transaction committed successfully. Redis actions pending.`)
    } catch (redisErr) {
      console.error('Redis error after commit:', redisErr);
    }

    return { transaction, entries: insertedEntries };

  } catch (err) {
    // Rollback on any failure
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

//exporting all the functions

module.exports = {
  validateEntries,
  postTransaction
}