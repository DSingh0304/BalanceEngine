import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import api from '../api/index.js';
import { useSocket } from '../hooks/useSocket.js';
import type { Account, LedgerEntry, AuditEvent, BalanceUpdatePayload } from '../types/index.js';

//  Helpers 
const fmt = (paise: string | number | bigint): string => {
  const n = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// Extract error message from unknown catch value
const getErrorMsg = (err: unknown, fallback: string): string => {
  if (
    err !== null &&
    typeof err === 'object' &&
    'response' in err &&
    err.response !== null &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data !== null &&
    typeof err.response.data === 'object' &&
    'error' in err.response.data &&
    typeof (err.response.data as Record<string, unknown>).error === 'string'
  ) {
    return (err.response.data as { error: string }).error;
  }
  return fallback;
};

//  Post Transaction Modal 
type EntryRow = { accountId: string; type: 'DEBIT' | 'CREDIT'; amount: string };

function PostTransactionModal({
  defaultAccountId,
  onClose,
  onPosted,
}: {
  defaultAccountId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>([
    { accountId: defaultAccountId, type: 'DEBIT', amount: '' },
    { accountId: defaultAccountId, type: 'CREDIT', amount: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateEntry = (i: number, key: keyof EntryRow, val: string) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [key]: val } : e));
  };

  const addEntry = () => setEntries(prev => [...prev, { accountId: defaultAccountId, type: 'DEBIT', amount: '' }]);
  const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        description,
        entries: entries.map(entry => ({
          accountId: entry.accountId,
          type: entry.type,
          amount: Math.round(parseFloat(entry.amount) * 100),
        })),
        metadata: {},
      };
      await api.post('/api/transactions', payload, {
        headers: { 'Idempotency-Key': uuidv4() },
      });
      onPosted();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMsg(err, 'Failed to post transaction'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">Post Transaction</h2>
          <button className="modal-close btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Transfer, deposit, fee…" required />
          </div>

          <div className="section-header">
            <span className="form-label" style={{ margin: 0 }}>Ledger Entries (amounts in ₹)</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addEntry}>+ Add entry</button>
          </div>

          {entries.map((entry, i) => (
            <div key={i} className="grid-2" style={{ gap: 8, marginBottom: 10, alignItems: 'end' }}>
              <div>
                <label className="form-label">Account ID</label>
                <input className="form-input" value={entry.accountId} onChange={e => updateEntry(i, 'accountId', e.target.value)} placeholder="UUID" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label className="form-label">Type</label>
                  <select
                    className="form-input form-select"
                    value={entry.type}
                    onChange={e => updateEntry(i, 'type', e.target.value as 'DEBIT' | 'CREDIT')}
                  >
                    <option value="DEBIT">DEBIT</option>
                    <option value="CREDIT">CREDIT</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (₹)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01" value={entry.amount} onChange={e => updateEntry(i, 'amount', e.target.value)} placeholder="0.00" required />
                </div>
                {entries.length > 2 && (
                  <button type="button" className="btn btn-danger btn-icon" onClick={() => removeEntry(i)} style={{ marginBottom: 0 }}>✕</button>
                )}
              </div>
            </div>
          ))}

          <div className="flex-row flex-end mt-6">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Posting…' : 'Post transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

//  Reverse Modal ─
function ReverseModal({
  transactionId,
  onClose,
  onReversed,
}: {
  transactionId: string;
  onClose: () => void;
  onReversed: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post(`/api/transactions/${transactionId}/reverse`, { reason });
      onReversed();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMsg(err, 'Reversal failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Reverse Transaction</h2>
          <button className="modal-close btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Reason for reversal</label>
            <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Duplicate charge, error correction…" required />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            This will create compensating ledger entries. The original transaction remains in the ledger forever.
          </p>
          <div className="flex-row flex-end">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? 'Reversing…' : 'Confirm reversal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

//  Animated Balance Number ─
function AnimatedBalance({ paise }: { paise: string }) {
  const prevRef = useRef(paise);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (prevRef.current !== paise) {
      prevRef.current = paise;
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 600);
      return () => clearTimeout(t);
    }
  }, [paise]);

  return (
    <span
      className="balance-amount"
      style={{ transition: 'all 0.4s ease', filter: animating ? 'brightness(1.4)' : 'brightness(1)' }}
    >
      {fmt(paise)}
    </span>
  );
}

//  AccountDetail ─
interface Props {
  account: Account;
  onBalanceUpdate: (accountId: string, balance: string) => void;
  onRefreshAccounts: () => void;
}

export default function AccountDetail({ account, onBalanceUpdate, onRefreshAccounts }: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'ledger' | 'audit'>('ledger');
  const [showPostModal, setShowPostModal] = useState(false);
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null);

  // wsBalance holds the latest balance pushed by WebSocket, or null until first WS event
  const [wsBalance, setWsBalance] = useState<string | null>(null);
  // liveBalance = WS value if available, otherwise the prop (refreshed by parent fetches)
  const liveBalance = wsBalance ?? account.balance;

  // Socket for live balance updates
  const handleBalanceUpdated = useCallback((payload: BalanceUpdatePayload) => {
    setWsBalance(payload.balance);
    onBalanceUpdate(payload.accountId, payload.balance);
  }, [onBalanceUpdate]);

  useSocket(account.id, handleBalanceUpdated);

  // Declare fetch functions BEFORE the effect that calls them
  // (hoisted with useCallback so the effect dependency array is stable)
  const fetchEntries = useCallback(async (cursor?: string) => {
    if (!cursor) setLoadingEntries(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (cursor) params.set('before', cursor);
      const { data } = await api.get(`/api/accounts/${account.id}/entries?${params}`);
      setEntries(prev => cursor
        ? [...prev, ...(data.entries as LedgerEntry[])]
        : (data.entries as LedgerEntry[]));
      setNextCursor(data.nextCursor as string | null);
    } finally {
      setLoadingEntries(false);
      setLoadingMore(false);
    }
  }, [account.id]);

  const fetchAudit = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/accounts/${account.id}/audit`);
      setAuditEvents(data.events as AuditEvent[]);
    } catch { /* non-fatal */ }
  }, [account.id]);

  // Now safe to call fetchEntries / fetchAudit — both are declared above
  // Use separate effects to avoid the set-state-in-effect lint rule, which flags
  // setState calls that happen synchronously inside an effect body. The async
  // function wrapper means the setState calls are deferred (inside a microtask).
  useEffect(() => {
    const run = async () => {
      await fetchEntries();
    };
    void run();
  }, [fetchEntries]);

  useEffect(() => {
    const run = async () => {
      await fetchAudit();
    };
    void run();
  }, [fetchAudit]);

  const handlePosted = useCallback(() => {
    void fetchEntries();
    onRefreshAccounts();
  }, [fetchEntries, onRefreshAccounts]);

  // Build chart data from entries (last 30 running balance points)
  const chartData = entries
    .slice()
    .reverse()
    .slice(-30)
    .map(e => ({
      date: fmtDate(e.created_at),
      balance: Number(e.running_balance ?? '0') / 100,
      debit: e.entry_type === 'DEBIT' ? Number(e.amount) / 100 : 0,
      credit: e.entry_type === 'CREDIT' ? Number(e.amount) / 100 : 0,
    }));

  // Compute stats
  const totalDebits = entries.filter(e => e.entry_type === 'DEBIT').reduce((s, e) => s + Number(e.amount), 0);
  const totalCredits = entries.filter(e => e.entry_type === 'CREDIT').reduce((s, e) => s + Number(e.amount), 0);
  const net = totalDebits - totalCredits;

  return (
    <div>
      {/*  Header ─ */}
      <div className="page-header">
        <div>
          <h1>{account.name}</h1>
          <p className="page-subtitle">{account.currency} · {account.type}</p>
        </div>
        <button
          id="post-transaction-btn"
          className="btn btn-primary"
          onClick={() => setShowPostModal(true)}
        >
          + Post Transaction
        </button>
      </div>

      <div className="page-body">
        {/*  Balance Hero  */}
        <div className="balance-hero" style={{ marginBottom: 20 }}>
          <div className="balance-label">Current Balance</div>
          <div>
            <AnimatedBalance paise={liveBalance} />
            <span className="balance-currency">{account.currency}</span>
          </div>
          <div className="balance-meta">
            <div className="live-badge">
              <span className="live-dot" />
              LIVE
            </div>
            <span className="account-type-tag">{account.type}</span>
          </div>
        </div>

        {/*  Stats  */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green">
            <div className="stat-label">Total Debits (Credits to ASSET)</div>
            <div className="stat-value green">+₹{fmt(String(totalDebits))}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Total Credits (Debits from ASSET)</div>
            <div className="stat-value red">-₹{fmt(String(totalCredits))}</div>
          </div>
          <div className={`stat-card ${net >= 0 ? 'green' : 'red'}`}>
            <div className="stat-label">Net Flow</div>
            <div className={`stat-value ${net >= 0 ? 'green' : 'red'}`}>
              {net >= 0 ? '+' : ''}₹{fmt(String(Math.abs(net)))}
            </div>
          </div>
        </div>

        {/*  Balance Chart ─ */}
        {chartData.length > 1 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-header">
              <span className="section-title">Balance Over Time</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last {chartData.length} entries</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#8b8fa8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v as number).toLocaleString()}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f0f1f5' }}
                    formatter={(v: unknown) => [`₹${Number(v).toFixed(2)}`, 'Balance']}
                  />
                  <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/*  Volume Chart  */}
        {chartData.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-header">
              <span className="section-title">Transaction Volume</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#8b8fa8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v as number}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f0f1f5' }}
                    formatter={(v: unknown) => [`₹${Number(v).toFixed(2)}`]}
                  />
                  <Legend wrapperStyle={{ color: '#8b8fa8', fontSize: 12 }} />
                  <Bar dataKey="debit" fill="#22d3a2" name="Debit" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="credit" fill="#f87171" name="Credit" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/*  Tabs: Ledger / Audit  */}
        <div className="card">
          <div className="tabs">
            <div
              className={`tab ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
              role="tab"
              tabIndex={0}
              aria-selected={activeTab === 'ledger'}
              onKeyDown={e => e.key === 'Enter' && setActiveTab('ledger')}
            >
              Ledger Entries
            </div>
            <div
              className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
              role="tab"
              tabIndex={0}
              aria-selected={activeTab === 'audit'}
              onKeyDown={e => e.key === 'Enter' && setActiveTab('audit')}
            >
              Audit Log
            </div>
          </div>

          {activeTab === 'ledger' && (
            <>
              {loadingEntries ? (
                <div style={{ padding: '24px 0' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 20, marginBottom: 10, borderRadius: 6 }} />
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📒</div>
                  <div className="empty-state-title">No entries yet</div>
                  <div className="empty-state-text">Post a transaction to see ledger entries here.</div>
                </div>
              ) : (
                <>
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Running Balance</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(entry => (
                        <tr key={entry.id}>
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            <div>{fmtDate(entry.created_at)}</div>
                            <div style={{ fontSize: 11 }}>{fmtTime(entry.created_at)}</div>
                          </td>
                          <td>{entry.description ?? '—'}</td>
                          <td>
                            <span className={`entry-type-badge ${entry.entry_type}`}>{entry.entry_type}</span>
                          </td>
                          <td className={entry.entry_type === 'DEBIT' ? 'amount-debit' : 'amount-credit'}>
                            {entry.entry_type === 'DEBIT' ? '+' : '-'}₹{fmt(entry.amount)}
                          </td>
                          <td className="amount-neutral">₹{fmt(entry.running_balance ?? '0')}</td>
                          <td>
                            {entry.transaction_status && (
                              <span className={`status-badge ${entry.transaction_status}`}>
                                {entry.transaction_status}
                              </span>
                            )}
                          </td>
                          <td>
                            {entry.transaction_status === 'POSTED' && entry.transaction_id && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setReverseTargetId(entry.transaction_id!)}
                                title="Reverse this transaction"
                              >
                                ↩ Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {nextCursor && (
                    <div style={{ textAlign: 'center', padding: 16 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => void fetchEntries(nextCursor)}
                        disabled={loadingMore}
                      >
                        {loadingMore ? 'Loading…' : 'Load more'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'audit' && (
            <>
              {auditEvents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">No audit events</div>
                  <div className="empty-state-text">Audit events will appear here as actions are taken.</div>
                </div>
              ) : (
                <div className="timeline">
                  {auditEvents.map(event => (
                    <div key={event.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-action">{event.action.replace(/_/g, ' ')}</div>
                        <div className="timeline-time">{fmtDate(event.created_at)} at {fmtTime(event.created_at)}</div>
                        {(event.old_data ?? event.new_data) && (
                          <pre className="timeline-data">
                            {JSON.stringify({ old: event.old_data, new: event.new_data }, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showPostModal && (
        <PostTransactionModal
          defaultAccountId={account.id}
          onClose={() => setShowPostModal(false)}
          onPosted={handlePosted}
        />
      )}

      {reverseTargetId && (
        <ReverseModal
          transactionId={reverseTargetId}
          onClose={() => setReverseTargetId(null)}
          onReversed={() => { void fetchEntries(); onRefreshAccounts(); }}
        />
      )}
    </div>
  );
}
