import { useEffect, useState } from 'react';
import { Alert, Button, Card, CopyButton, Empty, Field, TableWrap } from './shared';
import { opsApi, type PnlRow } from './opsApi';

const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());

/**
 * What the Agent's players staked, what the Agent paid out to winners, and the
 * difference, per game and day. A positive net means the players lost more than
 * they won. Winners are paid from the Agent's wallet, so this is the number to
 * watch against its balance.
 */
export function AgentPnl() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<Awaited<ReturnType<typeof opsApi.pnl>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setData(await opsApi.pnl({ from, to }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const copy = () =>
    (data?.rows ?? [])
      .map((r) => `${r.date} ${r.gameName}: stake ${r.totalStake}, paid ${r.totalPayout}, net ${r.net}`)
      .concat(data ? [`Total: stake ${data.totals.totalStake}, paid ${data.totals.totalPayout}, net ${data.totals.net}`] : [])
      .join('\n');

  const net = (n: number) => <span style={{ color: n < 0 ? 'var(--danger)' : undefined }}>{n.toLocaleString()}</span>;

  return (
    <>
      <Card title="Profit and loss" desc="Stake taken in against payouts you paid, per game and day. Positive = your players lost more than they won.">
        <div className="btn-row" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <Field label="From"><input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          <Button onClick={() => void load()}>Refresh</Button>
          {data && data.rows.length > 0 && <CopyButton getText={copy} />}
        </div>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
      <Card flush>
        {!data || data.rows.length === 0 ? (
          <Empty>No bets in this range.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Date</th><th>Game</th><th>Bets</th><th>Won</th>
                <th style={{ textAlign: 'right' }}>Stake</th>
                <th style={{ textAlign: 'right' }}>Paid out</th>
                <th style={{ textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: PnlRow) => (
                <tr key={`${r.gameId}${r.date}`}>
                  <td>{r.date}</td>
                  <td className="cell-strong">{r.gameName}</td>
                  <td className="cell-muted">{r.betCount}{r.pendingCount > 0 ? ` (${r.pendingCount} open)` : ''}</td>
                  <td className="cell-muted">{r.wonCount}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{r.totalStake.toLocaleString()}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{r.totalPayout.toLocaleString()}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{net(r.net)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="cell-strong">Total</td>
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
