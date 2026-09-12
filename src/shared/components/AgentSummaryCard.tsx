import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { AgentSummaryRow } from '../lib/types';
import { Alert, Card, Empty, RefreshButton, TableWrap } from './ui';

/**
 * Per (game, date, agent): stake collected against payout owed.
 *
 * `Net` is the book's result — stake in minus paid out — not any one tier's
 * profit. Splitting it between Admin and Agent needs the admin-side and
 * player-side odds now recorded on every prediction, and is a later
 * iteration; showing a single "net" here without claiming whose it is
 * avoids implying a split that hasn't been computed.
 */
export function AgentSummaryCard() {
  const [rows, setRows] = useState<AgentSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await api.predictionSummary());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card
      title="By agent, game and date"
      desc="Stake collected against payouts settled so far. Net is the book's, not yet split per tier."
      flush
      action={<RefreshButton onClick={() => void load()} refreshing={loading} />}
    >
      {error && (
        <div style={{ padding: '16px 16px 0' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {loading ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Empty>No predictions yet.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Date</th>
              <th>Game</th>
              <th>Agent</th>
              <th style={{ textAlign: 'right' }}>Bets</th>
              <th style={{ textAlign: 'right' }}>Staked</th>
              <th style={{ textAlign: 'right' }}>Paid out</th>
              <th style={{ textAlign: 'right' }}>Net</th>
              <th style={{ textAlign: 'right' }}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.agentId}-${r.gameId}-${r.date}`}>
                <td className="cell-muted">{r.date}</td>
                <td>{r.gameName}</td>
                <td className="cell-strong">{r.agentUsername}</td>
                <td className="cell-num" style={{ textAlign: 'right' }}>
                  {r.betCount}
                </td>
                <td className="cell-num" style={{ textAlign: 'right' }}>
                  {r.totalStake.toLocaleString()}
                </td>
                <td className="cell-num" style={{ textAlign: 'right' }}>
                  {r.totalPayout.toLocaleString()}
                </td>
                <td
                  className="cell-num"
                  style={{
                    textAlign: 'right',
                    color: r.net < 0 ? 'var(--danger)' : 'var(--success)',
                  }}
                >
                  {r.net > 0 ? '+' : ''}
                  {r.net.toLocaleString()}
                </td>
                <td className="cell-muted" style={{ textAlign: 'right' }}>
                  {r.pendingCount || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
