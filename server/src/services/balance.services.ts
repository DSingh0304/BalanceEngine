import nodeHttp = require("node:http");

const { pool } = require('pg');
const { redis } = require('../config/redis');

const computeBalance = async (accountId: string) => {
    const client = new pool.connect();
    try {
        const { rows } = await client.query(
            `SELECT
                COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END),0) AS total_debit,
                COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credit
            FROM ledger_entries
            WHERE account_id = $1`, [accountId]
        );

        const totalDebit = BigInt(rows.total_debit);
        const totalCredit = BigInt(rows.total_credit);

        return totalDebit - totalCredit;
    } finally {
        client.release();
    }
};

const cacheBalance = async (accountId: string, balance: bigint) => {
    try {
        await redis.set(`account:${accountId}:balance`, balance.toString());
    } catch (err) {
        console.error('Redis cache failure (logged but not thrown):', err);
    }
};

const getBalance = async (accountId: string) => {
    try{
        const cachedBalance = redis.get(`account:${accountId}:balance`);
        if(cacheBalance !== null){
            return BigInt(cachedBalance);
        }
    } catch (err) {
        console.error('Redis get failure. Falling back to database:', err);
    }

    const computedBalance = await computeBalance(accountId);
    return computedBalance;
};

module.exports = {
    computeBalance,
    cacheBalance,
    getBalance
};