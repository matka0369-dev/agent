import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CopyButton, Empty, Field, TableWrap, predictionTypeLabel, useLang, type PredictionType } from './shared';
import { opsApi } from './opsApi';
import {
  blockCopyText, blockTotal, cutAmount, groupBlocks, SORT_LABEL, sortRows, type BetRow, type SortKey,
} from './consolidate';

const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());

/**
 * Every bet placed by this Agent's players, added up per number: all the money
 * on a number in one game and day becomes one line. Odds are deliberately not
 * shown — every player of an Agent plays at the same rate, so the Agent only
 * needs the amounts. The percentage box takes that share off every amount
 * (0 by default), and Copy gives the numbers after the cut.
 */
export function ConsolidatedBets() {
  const { t } = useLang();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [gameId, setGameId] = useState('');
  const [sort, setSort] = useState<SortKey>('number-asc');
  const [pctText, setPctText] = useState('0');
  const [rows, setRows] = useState<BetRow[]>([]);
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pct = Math.min(Math.max(Number(pctText) || 0, 0), 100);

  async function load() {
    setLoading(true);
    try {
      const res = await opsApi.aggregate({ gameId: gameId || undefined, from, to });
      setRows(res.rows);
      // The game list comes from what the date range actually contains.
      if (!gameId) {
        const seen = new Map<string, string>();
        for (const r of res.rows) seen.set(r.gameId, r.gameName);
        setGames([...seen].map(([id, name]) => ({ id, name })));
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, gameId]);

  const blocks = useMemo(() => groupBlocks(rows), [rows]);
  const label = (typeId: string) => predictionTypeLabel(t, typeId as PredictionType);
  const allText = () => blocks.map((b) => blockCopyText(b, label(b.typeId), pct, sort)).join('\n\n');

  return (
    <>
      <Card title="Prediction totals" desc="All bets of your players, added up per number.">
        <div className="btn-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <Field label="From">
            <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Game">
            <select className="input" value={gameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort by">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {Object.entries(SORT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Cut (%)" hint="Taken off every amount. 0 = none.">
            <input
              className="input"
              style={{ width: 90 }}
              inputMode="decimal"
              value={pctText}
              onChange={(e) => setPctText(e.target.value)}
            />
          </Field>
          <div className="btn-row">
            <Button onClick={() => void load()} disabled={loading}>Refresh</Button>
            {blocks.length > 0 && <CopyButton getText={allText} />}
          </div>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {!error && blocks.length === 0 && !loading && (
        <Card><Empty>No bets in this range.</Empty></Card>
      )}

      {blocks.map((b) => (
        <Card
          key={b.key}
          title={`${b.gameName} — ${label(b.typeId)}`}
          desc={`${b.date}${pct > 0 ? ` · after −${pct}%` : ''}`}
          flush
        >
          <div style={{ padding: '0 16px 8px' }}>
            <CopyButton getText={() => blockCopyText(b, label(b.typeId), pct, sort)} />
          </div>
          <TableWrap>
            <thead>
              <tr><th>Number</th><th>Bets</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
            </thead>
            <tbody>
              {sortRows(b.rows, sort).map((r) => (
                <tr key={r.pickedNumber}>
                  <td className="cell-strong">{r.pickedNumber}</td>
                  <td className="cell-muted">{r.betCount}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>{cutAmount(r.totalStake, pct).toLocaleString()}</td>
                </tr>
              ))}
              <tr>
                <td className="cell-strong">Total</td>
                <td className="cell-muted">{b.rows.reduce((a, r) => a + r.betCount, 0)}</td>
                <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>{blockTotal(b.rows, pct).toLocaleString()}</td>
              </tr>
            </tbody>
          </TableWrap>
        </Card>
      ))}
    </>
  );
}
