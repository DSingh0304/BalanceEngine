import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { computeBalance } from './balance.services.js';
import { log } from './audit.services.js';

export const reconcileAccount = async (accountId: string) => {

  const computedBalance = await computeBalance(accountId);

  const cachedRaw = await redis.get(`account:${accountId}:balance`);
  const cachedBalance = cachedRaw !== null ? BigInt(cachedRaw) : null;

  // 3. Compare
  const discrepancy = cachedBalance !== null ? computedBalance - cachedBalance : 0n;

  if (discrepancy !== 0n || cachedBalance === null) {
    await log({
      action: 'RECONCILIATION_MISMATCH',
      entity_type: 'account',
      entity_id: accountId,
      old_data: { cached_balance: cachedRaw ?? 'missing' } as any,
      new_data: {
        computed_balance: computedBalance.toString(),
        discrepancy: discrepancy.toString(),
      } as any,
    });

    await redis.set(`account:${accountId}:balance`, computedBalance.toString());

    return {
      accountId,
      status: 'MISMATCH_CORRECTED',
      cached_balance: cachedRaw,
      computed_balance: computedBalance.toString(),
      discrepancy: discrepancy.toString(),
    };
  }

  return {
    accountId,
    status: 'OK',
    computed_balance: computedBalance.toString(),
    discrepancy: '0',
  };
};

export const reconcileAllAccounts = async () => {

  const { rows } = await pool.query(
    `SELECT DISTINCT account_id AS id FROM ledger_entries`,
  );

  const results = await Promise.all(rows.map((r) => reconcileAccount(r.id)));
  return results;
};
