# LedgerFlow - Balance Engine

LedgerFlow is a balance engine that records money movement using double-entry bookkeeping. It guarantees correctness by treating the ledger as the source of truth (immutable entries), uses idempotency to avoid duplicate processing, and publishes real-time balance updates to clients.

**Architecture**


How it works

- Double-entry: every logical money move creates two ledger entries - one debit and one credit - that always sum to zero. Balances are computed by summing immutable ledger entries per account, not by storing a single balance column.
- Idempotency: each client request for a transaction includes a client-generated Idempotency-Key. The server stores the key and result (in Redis) while processing; retries with the same key return the stored result so duplicates are avoided.

Core technical decisions

- **PostgreSQL (vs MongoDB):** PostgreSQL provides ACID transactions, row-level locking (`SELECT ... FOR UPDATE`) and strong consistency needed to atomically write paired ledger entries. This prevents money disappearing or appearing due to race conditions.
- **Store money in paise (integers):** use the smallest currency unit (paise) stored in an integer (`BIGINT`) to avoid floating-point rounding errors in financial math. Convert to decimal only for display in the client.
- **Cursor pagination (vs LIMIT/OFFSET):** ledger tables can grow very large; cursor-based pagination uses indexed positions to fetch the next page efficiently and avoids skipping/duplicating rows that can happen with OFFSET under concurrent inserts.

Project Status

- [x] Phase 0: Architecture, data models, contracts, repo setup
- [ ] Phase 1: PostgreSQL schema + core ledger engine
- [ ] Phase 2: REST API (auth, accounts, transactions, reversal)
- [ ] Phase 3: Real-time balance feed (Socket.io + Redis Pub/Sub)
- [ ] Phase 4: Reconciliation engine + audit trail
- [ ] Phase 5: React dashboard + visualizations
- [ ] Phase 6: Production hardening & deployment

