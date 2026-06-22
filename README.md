# LedgerFlow (BalanceEngine)

LedgerFlow is a production-grade double-entry ledger and payment engine. It records money movements using immutable ledger entries, guarantees correctness with ACID transactions, uses idempotency to prevent duplicate processing, and provides real-time balance updates to clients.

## Architecture

```text
                    +--------------------------+
                    |     React Dashboard      |
                    |  Account Ledger View     |
                    |  Transaction History     |
                    |  Live Balance Feed       |
                    +------------+-------------+
                                 |
                    +------------+------------+
                    | HTTP/REST  |            | WebSocket
                    v            |            v
           +--------------+      |   +------------------+
           |  Node.js     |      |   |  Node.js         |
           |  REST API    |      |   |  WebSocket Server|
           |  Auth,       |      |   |  Real-time       |
           |  Accounts,   |      |   |  Balance Feed    |
           |  Transactions|      |   +--------+---------+
           +--------------+      |            |
                  |              |            | Pub/Sub
                  | SQL          |   +--------v---------+
                  |              |   |      Redis       |
                  v              |   |  Idempotency Keys|
           +--------------+<-----+   |  Balance Cache   |
           |  PostgreSQL  |          |  WS Pub/Sub      |
           |  Users       |          +------------------+
           |  Accounts    |
           |  Transactions|
           |  LedgerEntries
           |  AuditLog    |
           +--------------+
```

## How It Works

### Double-Entry Bookkeeping
Every transaction creates at least two immutable ledger entries: a debit and a credit. The sum of all DEBITs must equal the sum of all CREDITs. For example, if Deep transfers ₹5.00 to Arjun:
```text
DEBIT  Deep_Wallet    500    (Deep's wallet decreases by 500 paise)
CREDIT Arjun_Wallet   500    (Arjun's wallet increases by 500 paise)
```

### Idempotency
To prevent duplicate transactions when networks fail, clients generate a unique `Idempotency-Key` (UUID) and send it with the request. The server caches the result in Redis. If the exact same key is received again, the cached result is returned instantly without executing the transaction twice.

## Running the Application

Start the entire application using Docker Compose:

```bash
# Build and run the infrastructure, API, and UI
docker compose up --build -d

# Check the logs if needed
docker compose logs -f
```

- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8080](http://localhost:8080)

## API Examples

**Register a User**
```bash
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"User Name","email":"user@test.com","password":"password123"}'
```

**Post a Transaction**
```bash
# Requires an Idempotency-Key header and JWT
curl -s -X POST http://localhost:8080/api/transactions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "description": "Deposit",
    "entries": [
      {"accountId": "<ACCOUNT_ID>", "type": "DEBIT", "amount": 10000},
      {"accountId": "<SYSTEM_ACCOUNT_ID>", "type": "CREDIT", "amount": 10000}
    ]
  }'
```

## Core Technical Decisions

- **PostgreSQL (vs MongoDB)**: Financial data requires ACID transactions. PostgreSQL guarantees that either both ledger entries (debit + credit) are written, or neither is. It also provides row-level locking (`SELECT FOR UPDATE`) to prevent deadlocks and race conditions.
- **Store Money in Paise (Integers)**: Floating-point arithmetic introduces rounding errors. All amounts are stored as integers in the smallest currency unit (paise) and are only divided by 100 on the frontend for display purposes.
- **Cursor Pagination (vs LIMIT/OFFSET)**: In a ledger with millions of entries, `LIMIT/OFFSET` becomes catastrophically slow because it scans and discards rows. We use cursor-based pagination to jump directly to the next indexed page.

## Project Status

- [x] Phase 0: Architecture, data models, contracts, repo setup
- [x] Phase 1: PostgreSQL schema + core ledger engine
- [x] Phase 2: REST API (auth, accounts, transactions, reversal)
- [x] Phase 3: Real-time balance feed (Socket.io + Redis Pub/Sub)
- [x] Phase 4: Reconciliation engine + audit trail
- [x] Phase 5: React dashboard + visualizations
- [x] Phase 6: Production hardening & deployment
