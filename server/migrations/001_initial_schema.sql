CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE account_type AS ENUM(
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
);

CREATE TYPE entry_type AS ENUM ('DEBIT', 'CREDIT');

CREATE TYPE transaction_status AS ENUM ('POSTED', 'REVERSED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type account_type NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    status transaction_status NOT NULL DEFAULT 'POSTED',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reversed_at TIMESTAMP WITH TIME ZONE,
    reversal_of UUID REFERENCES transactions(id)
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    entry_type entry_type NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);

CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);

CREATE INDEX idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);

CREATE INDEX idx_transactions_created_by ON transactions(created_by);

CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$ 
    BEGIN 
        RAISE EXCEPTION 'ledger_entries is append-only. Updates and deletes are not permitted. To correct a mistake, create a reversal transaction.';
        RETURN NULL;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_ledger_immutability
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_mutation();

INSERT INTO accounts (name, type, is_system, user_id, currency)
VALUES
    ('Settlement Account', 'ASSET' , true, NULL, 'INR'),
    ('Revenue Account',    'REVENUE', true, NULL, 'INR'),
    ('Expense Account',    'EXPENSE', true, NULL, 'INR');

