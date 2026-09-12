import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LEDGER_SOURCE_LABEL, LEDGER_WALLET_LABEL, type LedgerEntry } from '../lib/types';
import { Alert, Button, Card, Empty, TableWrap, formatDate } from './ui';

export type LedgerAgentOption = { id: string; username: string };

/**
 * Token movement history. Scoped server-side — an Admin sees its whole
 * subtree, an Agent its own players, a Player only itself — filters below
 * narrow within that scope, never outside it (the server re-checks
 * `agentId` against the caller's own agents regardless of what's passed).
 *
 * `showAccount` is off for the Player view, where every row is the same
 * account and the column would be dead weight.
 */
export function LedgerCard({
  title = 'Token history',
  desc,
  showAccount = true,
  limit = 100,
  refreshKey,
  showDateFilter = false,
  agents,
}: {
  title?: string;
  desc?: string;
  showAccount?: boolean;
  limit?: number;
  /** Bump to force a reload after a grant elsewhere on the page. */
  refreshKey?: number;
  /** Adds a "when" filter — a single calendar day, UTC. Off by default so
   *  the Player view (a short, single-account list) doesn't get a control
   *  it has little use for. */
  showDateFilter?: boolean;
  /** Adds an "Agent" filter defaulting to "All agents" — meaningful only for
   *  an Admin's view of its own multi-agent subtree. Omit everywhere else. */
  agents?: LedgerAgentOption[];
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [agentId, setAgentId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.ledger({ limit, date: date || undefined, agentId: agentId || undefined }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit, date, agentId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const hasFilters = showDateFilter || (agents && agents.length > 0);

  return (
    <Card
      title={title}
      desc={desc}
      flush
      action={
        hasFilters ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {agents && agents.length > 0 && (
              <select
                className="select"
                style={{ width: 'auto' }}
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                aria-label="Filter by agent"
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>
            )}
            {showDateFilter && (
              <input
                className="input"
                style={{ width: 'auto' }}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Filter by date"
              />
            )}
            {(date || agentId) && (
              <Button
                size="sm"
                onClick={() => {
                  setDate('');
                  setAgentId('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {error && (
        <div style={{ padding: '16px 16px 0' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : entries.length === 0 ? (
        <Empty>{date || agentId ? 'No token movements match this filter.' : 'No token movements yet.'}</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              {showAccount && <th>Account</th>}
              <th>Type</th>
              <th>Wallet</th>
              <th style={{ textAlign: 'right' }}>Change</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>By</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                {showAccount && (
                  <td>
                    <div
                      className="cell-strong"
                      // Agents and Players are the two tiers that actually
                      // hold a wallet balance — flagged in red so a subtree
                      // statement (an Admin's own agents, an Agent's own
                      // players) reads at a glance as "money moving", distinct
                      // from any other row.
                      style={{
                        color:
                          e.user.accountType === 'AGENT' || e.user.accountType === 'PLAYER'
                            ? 'var(--danger)'
                            : undefined,
                      }}
                    >
                      {e.user.username}
                    </div>
                    {e.note && <div className="cell-muted">{e.note}</div>}
                  </td>
                )}
                <td>
                  <span className="badge badge--muted">{LEDGER_SOURCE_LABEL[e.source]}</span>
                </td>
                <td className="cell-muted">{LEDGER_WALLET_LABEL[e.wallet]}</td>
                <td
                  className="cell-num"
                  style={{ color: e.delta < 0 ? 'var(--danger)' : 'var(--success)' }}
                >
                  {e.delta > 0 ? '+' : ''}
                  {e.delta.toLocaleString()}
                </td>
                <td className="cell-num">{e.balanceAfter.toLocaleString()}</td>
                <td className="cell-muted">{e.performedBy?.username ?? 'system'}</td>
                <td className="cell-muted">{formatDate(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
