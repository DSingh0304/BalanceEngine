// Type definitions for ledger accounts and entries
export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE";

export type EntryType = "DEBIT" | "CREDIT";

export type TransactionStatus = "POSTED" | "REVERSED";

export interface User {
  id: string;
  email: string;
  password: string;
  created_at: Date;
}

export interface Account {
  id: string;
  user_id: string | null;
  name: string;
  type: AccountType;
  currency: string;
  is_system: boolean;
  created_at: Date;
}

export interface Transaction {
  id: string;
  idempotency_key: string;
  description: string;
  metadata: Record<string, unknown>;
  status: TransactionStatus;
  created_by: string | null;
  created_at: Date;
  reversed_at: Date | null;
  reversal_of: string | null;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  amount: string;
  entry_type: EntryType;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

// Express Request type declaration override
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}