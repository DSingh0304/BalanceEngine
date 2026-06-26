import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import api from '../api/index.js';
import type { Account, AccountType } from '../types/index.js';
import AccountDetail from './AccountDetail.js';

const TYPE_ICONS: Record<AccountType, string> = {
  ASSET: 'A', LIABILITY: 'L', EQUITY: 'E', REVENUE: 'R', EXPENSE: 'X',
};

const formatBalance = (paise: string): string => {
  const n = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (
    err !== null && typeof err === 'object' &&
    'response' in err && err.response !== null && typeof err.response === 'object' &&
    'data' in err.response && err.response.data !== null && typeof err.response.data === 'object' &&
    'error' in err.response.data &&
    typeof (err.response.data as Record<string, unknown>).error === 'string'
  ) {
    return (err.response.data as { error: string }).error;
  }
  return fallback;
};

//  Create Account Modal ─
function CreateAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (acc: Account) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('ASSET');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/accounts', { name, type, currency });
      onCreated(data.account as Account);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMsg(err, 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">New Account</h2>
          <button className="modal-close btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="acc-name">Account name</label>
            <input id="acc-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="My Wallet" required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="acc-type">Type</label>
              <select id="acc-type" className="form-input form-select" value={type} onChange={e => setType(e.target.value as AccountType)}>
                {(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as AccountType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="acc-currency">Currency</label>
              <select id="acc-currency" className="form-input form-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="flex-row flex-end mt-4">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main Dashboard 
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Declare fetchAccounts BEFORE the effect that uses it
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/accounts');
      setAccounts(data.accounts as Account[]);
      setSelectedAccountId(prev => {
        if (!prev && (data.accounts as Account[]).length > 0) {
          return (data.accounts as Account[])[0].id;
        }
        return prev;
      });
    } catch {
      // handled by axios interceptor (401 → redirect, etc.)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { void navigate('/login'); return; }
    const run = async () => { await fetchAccounts(); };
    void run();
  }, [user, navigate, fetchAccounts]);

  const handleBalanceUpdate = useCallback((accountId: string, newBalance: string) => {
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, balance: newBalance } : a));
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null;
  const avatarLetter = user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="app-layout">
      {/*  Sidebar ─ */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <span className="sidebar-logo-text">BalanceEngine</span>
        </div>

        <div className="sidebar-section-label">Accounts</div>

        <div className="sidebar-accounts">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="account-item" style={{ marginBottom: 6 }}>
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                <div style={{ flex: 1, marginLeft: 10 }}>
                  <div className="skeleton" style={{ height: 12, width: '70%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '50%' }} />
                </div>
              </div>
            ))
          ) : accounts.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-state-icon">📂</div>
              <p className="empty-state-text">No accounts yet</p>
            </div>
          ) : (
            accounts.map(account => (
              <div
                key={account.id}
                className={`account-item ${selectedAccountId === account.id ? 'active' : ''}`}
                onClick={() => setSelectedAccountId(account.id)}
                role="button"
                tabIndex={0}
                aria-label={`${account.name} account`}
                onKeyDown={e => e.key === 'Enter' && setSelectedAccountId(account.id)}
              >
                <div className="account-item-left">
                  <div className={`account-type-badge badge-${account.type}`}>
                    {TYPE_ICONS[account.type]}
                  </div>
                  <span className="account-item-name">{account.name}</span>
                </div>
                <span className="account-item-balance">
                  {formatBalance(account.balance)}
                </span>
              </div>
            ))
          )}
        </div>

        <button className="sidebar-add-btn" onClick={() => setShowCreateModal(true)} id="create-account-btn">
          <span>+</span> New account
        </button>

        <div className="sidebar-user">
          <div className="user-avatar">{avatarLetter}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className="logout-btn" onClick={() => { logout(); void navigate('/login'); }} title="Sign out" aria-label="Sign out">
            ↩
          </button>
        </div>
      </aside>

      {/*  Main ─ */}
      <main className="main-content">
        {selectedAccount ? (
          <AccountDetail
            account={selectedAccount}
            onBalanceUpdate={handleBalanceUpdate}
            onRefreshAccounts={fetchAccounts}
          />
        ) : (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon">⚡</div>
            <h2>Select an account</h2>
            <p>Choose an account from the sidebar, or create a new one to get started.</p>
            {!loading && accounts.length === 0 && (
              <button className="btn btn-primary mt-6" onClick={() => setShowCreateModal(true)}>
                + Create your first account
              </button>
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateAccountModal
          onClose={() => setShowCreateModal(false)}
          onCreated={acc => {
            setAccounts(prev => [...prev, acc]);
            setSelectedAccountId(acc.id);
          }}
        />
      )}
    </div>
  );
}
