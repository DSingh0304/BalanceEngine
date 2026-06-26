export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  user_id: string | null;
  name: string;
  type: AccountType;
  currency: string;
  is_system: boolean;
  balance: string; // bigint as string (paise)
  created_at: string;
}

export type EntryType = 'DEBIT' | 'CREDIT';
export type TransactionStatus = 'POSTED' | 'REVERSED';

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  entry_type: EntryType;
  amount: string; // bigint as string
  running_balance?: string;
  description?: string;
  transaction_status?: TransactionStatus;
  created_at: string;
}

export interface Transaction {
  id: string;
  idempotency_key: string;
  description: string;
  metadata: Record<string, unknown>;
  status: TransactionStatus;
  created_by: string | null;
  created_at: string;
  reversed_at: string | null;
  reversal_of: string | null;
  entries?: LedgerEntry[];
}

export interface BalanceResponse {
  balance: string;
  balance_display: string;
  currency: string;
  as_of: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface BalanceUpdatePayload {
  accountId: string;
  balance: string;
  transactionId: string;
  timestamp: string;
}
