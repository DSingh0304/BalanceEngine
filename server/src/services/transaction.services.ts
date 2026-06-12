import { pool } from "../config/db.js";
import { redis } from "../config/redis.js";
import { log } from "../services/audit.services.js";
import type { Transaction, LedgerEntry } from "../types/index.js";

// Validate entries balance and amounts
const validateEntries = (entries: Partial<LedgerEntry>[]): void => {
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
export const postTransaction = async (
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
      [
        idempotencyKey,
        metadata,
        metadata.note || metadata.description || "Transaction",
      ],
    );

    const transaction: Transaction = txRows[0];
    const insertedEntries = [];

    // Insert each associated ledger entry
    for (const entry of entries) {
      const { rows: entryRows } = await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type) VALUES ($1, $2, $3, $4) RETURNING *`,
        [transaction.id, entry.account_id, entry.amount, entry.entry_type],
      );
      // push single inserted row instead of the rows array
      insertedEntries.push(entryRows[0]);
    }
    // Commit transaction and log success
    await client.query("COMMIT");

    try {
      console.log(`Transaction committed successfully. Redis actions pending.`);
    } catch (redisErr) {
      console.error("Redis error after commit:", redisErr);
    }

    return { transaction, entries: insertedEntries };
  } catch (err) {
    // Rollback on any failure
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

//Reverse transaction function

export const reverseTransaction = async (
  id: string,
  idempotency_key: string,
  ip_address?: string | null,
) => {
  const client = await pool.connect();
  let originalTx: Transaction;
  let originalEntries: LedgerEntry[];
  try {
    await client.query("BEGIN");
    // Lock the transaction row to prevent concurrent reversals
    const { rows: txRows } = await client.query(
      "SELECT * FROM transactions WHERE id = $1 FOR UPDATE",
      [id],
    );
    originalTx = txRows[0];

    if (!originalTx) {
      throw new Error("Transaction not found");
    }
    if (originalTx.status == "REVERSED") {
      throw new Error("Transaction is already reversed.");
    }

    const { rows: entriesRows } = await client.query(
      "SELECT * FROM ledger_entries WHERE transaction_id = $1",
      [id],
    );
    originalEntries = entriesRows;

    const reversalEntries: Partial<LedgerEntry>[] = originalEntries.map(
      (entry: {
        account_id: any;
        amount: string | number | bigint;
        entry_type: string;
      }) => ({
        account_id: entry.account_id,
        // keep amounts as strings so validateEntries can call BigInt safely
        amount: String(entry.amount),
        entry_type: entry.entry_type === "DEBIT" ? "CREDIT" : "DEBIT",
      }),
    );

    validateEntries(reversalEntries);

    const accountIds = Array.from(
      new Set(reversalEntries.map((e) => e.account_id)),
    ).sort();

    const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `SELECT id FROM accounts WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      accountIds,
    );

    // Prevent duplicate reversals: check if a reversal already exists for this transaction
    const { rows: existingReversals } = await client.query(
      `SELECT * FROM transactions WHERE reversal_of = $1`,
      [id],
    );
    if (existingReversals.length > 0) {
      const existingTx = existingReversals[0] as Transaction;
      const { rows: existingEntries } = await client.query(
        `SELECT * FROM ledger_entries WHERE transaction_id = $1`,
        [existingTx.id],
      );
      // commit read-only outcome and return existing reversal
      await client.query("COMMIT");
      try {
        await log({
          entity_type: "transaction",
          entity_id: id,
          action: "REVERSAL_ALREADY_EXISTS",
          old_data: originalTx as unknown as Record<string, unknown>,
          new_data: existingTx as unknown as Record<string, unknown>,
          ip_address: ip_address ?? null,
        });
      } catch (err) {
        console.error("Audit log failure after detecting existing reversal:", err);
      }
      return { transaction: existingTx, entries: existingEntries };
    }

    const { rows: newTxRows } = await client.query(
      `INSERT INTO transactions (idempotency_key, metadata, reversal_of, status)
       VALUES ($1, $2, $3, 'POSTED') RETURNING *`,
      [idempotency_key, { note: "Reversal" }, id],
    );
    const newTransaction: Transaction = newTxRows[0];

    const insertedEntries = [];
    for (const entry of reversalEntries) {
      const { rows: entryRows } = await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [newTransaction.id, entry.account_id, entry.amount, entry.entry_type],
      );
      // push single inserted row instead of an array
      insertedEntries.push(entryRows[0]);
    }

    await client.query(
      `UPDATE transactions SET status = 'REVERSED' WHERE id = $1`,
      [id],
    );

    await client.query("COMMIT");

    try {
      await log({
        entity_type: "transaction",
        entity_id: id,
        action: "REVERSAL",
        old_data: originalTx as unknown as Record<string, unknown>,
        new_data: newTransaction as unknown as Record<string, unknown>,
        ip_address: ip_address ?? null,
      });
    } catch (err) {
      console.error(" Audit log failure after reversal commit:", err);
    }

    return { transaction: newTransaction, entries: insertedEntries };
  } catch (err) {
    
    await client.query("ROLLBACK");
    throw err;
  } finally {

    client.release();
  }
};

//Exporting all the functions

