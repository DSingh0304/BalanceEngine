import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';

export const computeBalance = async (accountId: string) => {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(
            `SELECT
                COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END),0) AS total_debit,
                COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credit
            FROM ledger_entries
            WHERE account_id = $1`, [accountId]
        );

        const row = rows[0];
        const totalDebit = BigInt(row ? row.total_debit : 0);
        const totalCredit = BigInt(row ? row.total_credit : 0);

        return totalDebit - totalCredit;
    } finally {
        client.release();
    }
};

export const cacheBalance = async (accountId: string, balance: bigint) => {
    try {
        await redis.set(`account:${accountId}:balance`, balance.toString());
    } catch (err) {
        console.error('Redis cache failure (logged but not thrown):', err);
    }
};

export const getBalance = async (accountId: string) => {
    try {
        const cachedBalance = await redis.get(`account:${accountId}:balance`);
        if (cachedBalance !== null) {
            return BigInt(cachedBalance);
        }
    } catch (err) {
        console.error('Redis get failure. Falling back to database:', err);
    }

    const computedBalance = await computeBalance(accountId);
    return computedBalance;
};
