import { pool } from "../config/db.js";
import { redis } from "../config/redis.js";
import { computeBalance } from "./balance.services.js";
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
  createdBy?: string,
) => {
  validateEntries(entries);
  const accountIds = Array.from(new Set(entries.map((e) => e.account_id))).sort() as string[];

  // Connect client and begin transaction
  const client = await pool.connect();
  let transaction: Transaction;
  let insertedEntries: any[];

  try {
    await client.query("BEGIN");
    const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(`, `);
    // Lock accounts in sorted order to prevent deadlocks
    const { rows: lockedAccounts } = await client.query(
      `SELECT id FROM accounts WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      accountIds,
    );
    if (lockedAccounts.length !== accountIds.length) {
      throw new Error("Transaction Failed: One or more accounts do not exist.");
    }

    // Insert the main transaction record
    const { rows: txRows } = await client.query(
      `INSERT INTO transactions (idempotency_key, metadata, status, description, created_by)
       VALUES ($1, $2, 'POSTED', $3, $4) RETURNING *`,
      [
        idempotencyKey,
        metadata,
        metadata.note || metadata.description || "Transaction",
        createdBy ?? null,
      ],
    );

    transaction = txRows[0];
    insertedEntries = [];

    // Insert each associated ledger entry
    for (const entry of entries) {
      const { rows: entryRows } = await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [transaction.id, entry.account_id, entry.amount, entry.entry_type],
      );
      insertedEntries.push(entryRows[0]);
    }

    // Commit - money is now safely recorded
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Post-commit: update Redis balance cache + publish Pub/Sub events

  try {
    for (const accountId of accountIds) {
      const newBalance = await computeBalance(accountId);
      await redis.set(`account:${accountId}:balance`, newBalance.toString());

      await redis.publish(
        "balance_updates",
        JSON.stringify({
          accountId,
          balance: newBalance.toString(),
          transactionId: transaction!.id,
          timestamp: new Date().toISOString(),
        }),
      );
    }
    console.log(`[postTransaction] Redis updated and balance_updates published for tx ${transaction!.id}`);
  } catch (redisErr) {
    console.error("[postTransaction] Redis post-commit error (non-fatal):", redisErr);
  }

  return { transaction: transaction!, entries: insertedEntries };
};

// Reverse transaction function
export const reverseTransaction = async (
  id: string,
  idempotency_key: string,
  ip_address?: string | null,
  createdBy?: string,
  reason?: string,
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
        amount: String(entry.amount),
        entry_type: entry.entry_type === "DEBIT" ? "CREDIT" : "DEBIT",
      }),
    );

    validateEntries(reversalEntries);

    const accountIds = Array.from(
      new Set(reversalEntries.map((e) => e.account_id)),
    ).sort() as string[];

    const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `SELECT id FROM accounts WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      accountIds,
    );

    // Prevent duplicate reversals
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

    const reversalMeta = { note: reason ?? "Reversal", reason, reversed_transaction_id: id };
    const { rows: newTxRows } = await client.query(
      `INSERT INTO transactions (idempotency_key, metadata, reversal_of, status, description, created_by)
       VALUES ($1, $2, $3, 'POSTED', $4, $5) RETURNING *`,
      [idempotency_key, reversalMeta, id, `Reversal: ${reason ?? ""}`, createdBy ?? null],
    );
    const newTransaction: Transaction = newTxRows[0];

    const insertedEntries = [];
    for (const entry of reversalEntries) {
      const { rows: entryRows } = await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [newTransaction.id, entry.account_id, entry.amount, entry.entry_type],
      );
      insertedEntries.push(entryRows[0]);
    }

    await client.query(
      `UPDATE transactions SET status = 'REVERSED', reversed_at = NOW() WHERE id = $1`,
      [id],
    );

    await client.query("COMMIT");

    // Post-commit: update Redis balance cache + publish events
    try {
      for (const accountId of accountIds) {
        const newBalance = await computeBalance(accountId);
        await redis.set(`account:${accountId}:balance`, newBalance.toString());
        await redis.publish(
          "balance_updates",
          JSON.stringify({
            accountId,
            balance: newBalance.toString(),
            transactionId: newTransaction.id,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (redisErr) {
      console.error("[reverseTransaction] Redis post-commit error (non-fatal):", redisErr);
    }

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
      console.error("Audit log failure after reversal commit:", err);
    }

    return { transaction: newTransaction, entries: insertedEntries };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
