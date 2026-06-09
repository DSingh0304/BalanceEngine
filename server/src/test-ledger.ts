import crypto from 'crypto';
import { pool } from './config/db.js';
import { postTransaction } from './services/transaction.services.js'
import { getBalance } from './services/balance.services.js'

const runTest = async () => {
    console.log('Starting Ledger Engine Tests...\n');
    const client = await pool.connect();

    try {
        const accountA = crypto.randomUUID();
        const accountB = crypto.randomUUID();

        await client.query(
            `INSERT INTO accounts (id, type, name) VALUES ($1, 'ASSET', 'Test Asset'), ($2, 'LIABILITY', 'Test Liability')`, [
            accountA,
            accountB
        ]);
        console.log('Created temporary test accounts.');
        const idempotencyKey = crypto.randomUUID();
        // TEST 1: Unbalanced Entries (Should Fail)
        try {
            await postTransaction(crypto.randomUUID(), {}, [
                { account_id: accountA, amount: 1000n, entry_type: 'DEBIT' },
                { account_id: accountB, amount: 2000n, entry_type: 'CREDIT' }
            ]);
            console.log('TEST 2 PASSED: Valid transaction posted successfully.');
        } catch (err) {
            console.error('TEST 2 FAILED:', err.message);
        }
        // TEST 2: Valid Transaction (Should Succeed)
        try {
            await postTransaction(idempotencyKey, { note: 'Test Transfer' }, [
                { account_id: accountA, amount: 1000n, entry_type: 'DEBIT' },
                { account_id: accountB, amount: 1000n, entry_type: 'CREDIT' }
            ]);
            console.log('TEST 2 PASSED: Valid transaction posted successfully.');
        } catch (err) {
            console.error('TEST 2 FAILED:', err.message);
        }

        // TEST 3: Duplicate Idempotency Key (Should Fail)
        try {
            await postTransaction(idempotencyKey, { note: 'Duplicate Attempt' }, [
                { account_id: accountA, amount: 1000n, entry_type: 'DEBIT' },
                { account_id: accountB, amount: 1000n, entry_type: 'CREDIT' }
            ]);
            console.error('TEST 3 FAILED: Duplicate idempotency key was allowed!');
        } catch (err) {
            console.log('TEST 3 PASSED: Duplicate transaction rejected (Idempotency enforced).');
        }

        // TEST 4: Get Balance (Should Reflect Test 2)
        const balanceA = await getBalance(accountA);
        if (balanceA === 1000n) {
            console.log('TEST 4 PASSED: Balance correctly computed and cached.');
        } else {
            console.error(`TEST 4 FAILED: Expected 1000, got ${balanceA}`);
        }

    } catch (err) {
        console.error('Critical Error during tests:', err);
    } finally {
        client.release();
        // Close the database pool so the Node process can exit gracefully
        await pool.end();
        // Close the Redis connections to allow exit
        const { redis, redisSub } = require('./config/redis');
        redis.quit();
        redisSub.quit();
        console.log('\nTests completed.');
    }
};

await runTest();