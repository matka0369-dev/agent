import { useEffect, useMemo } from 'react';
import { Alert, Button, Card, CopyButton, Empty, Field, TableWrap, predictionTypeLabel, useLang, type PredictionType } from './shared';
import {
  blockCopyText, blockTotal, cutAmount, groupBlocks, SORT_LABEL, sortRows, type SortKey,
} from './consolidate';
import { dayString, ensureAll, refresh, setFilters, usePredictions } from './predictionsStore';

/**
 * Every bet placed by this Agent's players, added up per number: all the money
 * on a number in one game becomes one line, for one day at a time. Odds are deliberately not
 * shown — every player of an Agent plays at the same rate, so the Agent only
 * needs the amounts. The percentage box takes that share off every amount
 * (0 by default), and Copy gives the numbers after the cut.
 *
 * This is the "Classic" view. Its filters and data come from the shared store
 * (see predictionsStore.ts), so it shows the same thing as the Board and
 * switching between them costs no request.
 */
export function ConsolidatedBets() {
  const { t } = useLang();
  const { filters, rows, games, error, loading } = usePredictions();
  const { date, gameId, sort, percent } = filters;

  const pct = Math.min(Math.max(Number(percent) || 0, 0), 100);

  useEffect(() => {
    ensureAll(); // from cache when it is still fresh
  }, []);

  const blocks = useMemo(() => groupBlocks(rows), [rows]);
  const label = (typeId: string) => predictionTypeLabel(t, typeId as PredictionType);
  const allText = () => blocks.map((b) => blockCopyText(b, label(b.typeId), pct, sort)).join('\n\n');

  return (
    <>
      <Card title="Prediction totals" desc="All bets of your players, added up per number.">
        <div className="btn-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <Field label="Date">
            <input className="input" type="date" value={date} onChange={(e) => setFilters({ date: e.target.value })} />
          </Field>
          <div className="btn-row" style={{ alignSelf: 'flex-end' }}>
            <Button onClick={() => setFilters({ date: dayString(0) })}>Today</Button>
            <Button onClick={() => setFilters({ date: dayString(-1) })}>Yesterday</Button>
          </div>
          <Field label="Game">
            <select className="input" value={gameId} onChange={(e) => setFilters({ gameId: e.target.value })}>
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort by">
            <select className="input" value={sort} onChange={(e) => setFilters({ sort: e.target.value as SortKey })}>
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
              value={percent}
              placeholder="0"
              onChange={(e) => setFilters({ percent: e.target.value })}
            />
          </Field>
          <div className="btn-row">
            <Button onClick={() => refresh()} disabled={loading}>Refresh</Button>
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
