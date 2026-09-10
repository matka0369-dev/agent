import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LEDGER_SOURCE_LABEL, LEDGER_WALLET_LABEL, type LedgerEntry } from '../lib/types';
import { Alert, Card, Empty, TableWrap, formatDate } from './ui';

/**
 * Token movement history. Scoped server-side — an Admin sees its whole
 * subtree, an Agent its own players, a Player only itself — so this renders
 * whatever it's given without filtering.
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
}: {
  title?: string;
  desc?: string;
  showAccount?: boolean;
  limit?: number;
  /** Bump to force a reload after a grant elsewhere on the page. */
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setEntries(await api.ledger(limit));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Card title={title} desc={desc} flush>
      {error && (
        <div style={{ padding: '16px 16px 0' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : entries.length === 0 ? (
        <Empty>No token movements yet.</Empty>
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
                    <div className="cell-strong">{e.user.username}</div>
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
