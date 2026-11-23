import { useEffect, useState } from 'react';
import { Alert, Button, Card, CopyButton, Empty, Field, TableWrap } from './shared';
import { opsApi, type PnlRow } from './opsApi';
import { dayString } from './predictionsStore';
import './filterRow.css';

/**
 * What the Agent's players staked, what the Agent paid out to winners, and the
 * difference, per game and day. A positive net means the players lost more than
 * they won. Winners are paid from the Agent's wallet, so this is the number to
 * watch against its balance. One day at a time, like the Predictions tab.
 */
export function AgentPnl() {
  const [date, setDate] = useState(dayString(0));
  const [data, setData] = useState<Awaited<ReturnType<typeof opsApi.pnl>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setData(await opsApi.pnl({ from: date, to: date }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const copy = () =>
    (data?.rows ?? [])
      .map((r) => `${r.gameName}: stake ${r.totalStake}, paid ${r.totalPayout}, net ${r.net}`)
      .concat(data ? [`Total: stake ${data.totals.totalStake}, paid ${data.totals.totalPayout}, net ${data.totals.net}`] : [])
      .join('\n');

  const net = (n: number) => <span style={{ color: n < 0 ? 'var(--danger)' : undefined }}>{n.toLocaleString()}</span>;

  return (
    <>
      <Card title="Profit and loss" desc="Stake taken in against payouts you paid, per game. Positive = your players lost more than they won.">
        <div className="filter-row">
          <Field label="Date">
            {/* A cleared date goes back to today rather than asking for everything. */}
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || dayString(0))} />
          </Field>
          <Button onClick={() => setDate(dayString(0))}>Today</Button>
          <Button onClick={() => setDate(dayString(-1))}>Yesterday</Button>
          <Button onClick={() => void load()}>Refresh</Button>
          {data && data.rows.length > 0 && <CopyButton getText={copy} />}
        </div>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
      <Card flush>
        {!data || data.rows.length === 0 ? (
          <Empty>No bets on this day.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Game</th><th>Bets</th><th>Won</th>
                <th style={{ textAlign: 'right' }}>Stake</th>
                <th style={{ textAlign: 'right' }}>Paid out</th>
                <th style={{ textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: PnlRow) => (
                <tr key={`${r.gameId}${r.date}`}>
                  <td className="cell-strong">{r.gameName}</td>
                  <td className="cell-muted">{r.betCount}{r.pendingCount > 0 ? ` (${r.pendingCount} open)` : ''}</td>
                  <td className="cell-muted">{r.wonCount}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{r.totalStake.toLocaleString()}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{r.totalPayout.toLocaleString()}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{net(r.net)}</td>
                </tr>
              ))}
              <tr>
                <td className="cell-strong">Total</td>
                <td className="cell-muted">{data.totals.betCount}</td>
                <td className="cell-muted">{data.totals.wonCount}</td>
                <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>{data.totals.totalStake.toLocaleString()}</td>
                <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>{data.totals.totalPayout.toLocaleString()}</td>
                <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>{net(data.totals.net)}</td>
              </tr>
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
