import { pool } from '../config/db.js';
import type { LedgerEntry } from '../types/index.js';

export const getLedgerEntries = async (
    accountId: string,
    cursor?: { createdAt: Date, id: string },
    limit: number = 50
) => {
    const client = await pool.connect();

    try{
        let queryText = '';
        let queryParams: any[] = [];
        if (cursor) {
            queryText = `
                SELECT * FROM ledger_entries
                WHERE account_id = $1
                AND (created_at, id) < ($2, $3)
                ORDER BY created_at DESC, id DESC
                LIMIT $4
            `;
            queryParams = [accountId, cursor.createdAt, cursor.id, limit]
        } else {
            queryText = `
                SELECT * FROM ledger_entries
                WHERE account_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT $2
            `;
            queryParams = [accountId, limit]
        }
        const { rows } = await client.query(queryText, queryParams);
        const entries: LedgerEntry[] = rows.map((row: any) => ({
            ...row,
            amount: BigInt(row.amount)
        }));

        const nextCursor = rows.length === limit?{
            createdAt: rows[rows.length - 1].created_at,
            id: rows[rows.length - 1].id
        } : null

        return { entries, nextCursor }

    }finally{
        client.release();
    }
};