import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, CopyButton, Empty, RefreshButton, predictionTypeLabel, useLang, type PredictionType } from './shared';
import { dayString, ensureAll, refresh, setFilters, usePredictions } from './predictionsStore';
import type { BetRow } from './consolidate';
import './predictionsBoard.css';

/**
 * The Agent's book of predictions, laid out the way the matka dashboard's
 * data-tables page does it: a row of control cards (totals + percentage,
 * filters, date) over a grid of compact tables, one per bet type. Each table
 * is just Number and Amount with its own Total and a copy button.
 *
 * - A picked number is a fixed-width code, so numbers sort as strings.
 * - Odds are never shown: every player of an Agent plays at the same rate, so
 *   the Agent only needs the amounts.
 * - The percentage is a display lens only. Nothing is stored or re-fetched.
 *
 * There is no Date column. The page shows one day, today by default (Today /
 * Yesterday buttons); a number appears once with its combined amount. A date
 * range lives on a single player's page, not here.
 */

const TZ = 'Asia/Kolkata';

export interface Line {
  number: string;
  bets: number;
  amount: number; // before the percentage cut
}

type SortKey = 'number' | 'amount';

// No thousands separators, as on the dashboard's data-tables page.
const rowsKey = (lines: Line[]) => lines.length;
export const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, useGrouping: false }).format(n);

// First digit of a Jodi ("05" -> 0, "47" -> 4).
const jodiDigit = (n: string) => Math.min(9, Math.max(0, Math.floor((parseInt(n, 10) || 0) / 10)));

export function TypeTable({
  typeId,
  lines,
  label,
  pct,
  hitDigit,
  winner,
}: {
  typeId: PredictionType;
  label: string;
  lines: Line[];
  pct: number;
  /** The declared open ank: the Jodi group starting with it is highlighted. */
  hitDigit: number | null;
  /** The declared winning number for this (non-Jodi) type, as the picked-number string. */
  winner: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [asc, setAsc] = useState(true);

  const cut = (amount: number) => (pct > 0 ? Math.round(amount * (1 - pct / 100)) : amount);
  const shown = useMemo(() => lines.map((l) => ({ ...l, amount: cut(l.amount) })), [lines, pct]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = shown.reduce((sum, l) => sum + l.amount, 0);
  const betTotal = shown.reduce((sum, l) => sum + l.bets, 0);

  const sorted = useMemo(() => {
    const copy = [...shown];
    copy.sort((a, b) => {
      const c =
        sortKey === 'number'
          ? a.number < b.number ? -1 : a.number > b.number ? 1 : 0
          : a.amount - b.amount;
      return asc ? c : -c;
    });
    return copy;
  }, [shown, sortKey, asc]);

  function toggle(key: SortKey) {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(key === 'number');
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (asc ? ' ▲' : ' ▼') : '');

  const isJodi = typeId === 'JODI';

  // Bring the winning row into view inside this table's scroll box.
  useEffect(() => {
    const box = scrollRef.current;
    const row = box?.querySelector<HTMLElement>('.pb-hit, .pb-hit-group');
    if (!box || !row) return;
    box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight / 3;
  }, [winner, hitDigit, rowsKey(lines)]); // eslint-disable-line react-hooks/exhaustive-deps
  // Jodi rows are grouped by first digit with a subtotal, as the mdash page
  // does — only while sorted by number, since a group means nothing otherwise.
  const grouped = isJodi && sortKey === 'number' && asc;

  const copyAll = () => sorted.map((l) => `${l.number}-${l.amount}`).join('\n');
  const copyJodiGroup = (digit: number) => {
    const amounts = new Map(shown.map((l) => [l.number.padStart(2, '0'), l.amount]));
    return Array.from({ length: 10 }, (_, i) => {
      const key = `${digit}${i}`;
      return `${key}-${amounts.get(key) ?? 0}`;
    }).join('\n');
  };

  type Row = { kind: 'line'; line: Line } | { kind: 'group'; digit: number; total: number };
  const rows: Row[] = [];
  if (grouped) {
    let current = -1;
    let sum = 0;
    for (const l of sorted) {
      const d = jodiDigit(l.number);
      if (current !== -1 && d !== current) rows.push({ kind: 'group', digit: current, total: sum }), (sum = 0);
      current = d;
      sum += l.amount;
      rows.push({ kind: 'line', line: l });
    }
    if (current !== -1) rows.push({ kind: 'group', digit: current, total: sum });
  } else {
    for (const l of sorted) rows.push({ kind: 'line', line: l });
  }

  return (
    <section className="pb-table">
      <header className="pb-table__head">
        <h3>{label}</h3>
        <span className="pb-chip" title={`${betTotal} bets`}>
          Total: {fmt(total)}
        </span>
        {isJodi && hitDigit !== null && (
          <span className="pb-chip pb-chip--hit">
            Ank {hitDigit}
            <button
              type="button"
              className="pb-icon"
              title={`Copy ${hitDigit}0–${hitDigit}9`}
              onClick={() => void navigator.clipboard?.writeText(copyJodiGroup(hitDigit))}
            >
              ⧉
            </button>
          </span>
        )}
        <CopyButton getText={copyAll} />
      </header>
      <div className="pb-table__scroll" ref={scrollRef}>
        <table className="pb-grid">
          <thead>
            <tr>
              <th>
                <button type="button" className="pb-sort" onClick={() => toggle('number')}>
                  Number{arrow('number')}
                </button>
              </th>
              <th className="pb-num">
                <button type="button" className="pb-sort" onClick={() => toggle('amount')}>
                  Amount{arrow('amount')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              r.kind === 'group' ? (
                <tr key={`g${r.digit}`} className={`pb-group ${isJodi && r.digit === hitDigit ? 'pb-hit-group' : ''}`}>
                  <td>
                    {r.digit} Total{' '}
                    <button
                      type="button"
                      className="pb-icon"
                      title={`Copy ${r.digit}0–${r.digit}9`}
                      onClick={() => void navigator.clipboard?.writeText(copyJodiGroup(r.digit))}
                    >
                      ⧉
                    </button>
                  </td>
                  <td className="pb-num">{fmt(r.total)}</td>
                </tr>
              ) : (
                <tr key={r.line.number} className={
                    isJodi ? (jodiDigit(r.line.number) === hitDigit ? 'pb-hit' : undefined) : winner !== null && r.line.number === winner ? 'pb-hit' : undefined
                  }
                >
                  <td className="pb-strong">{r.line.number} —</td>
                  <td className="pb-num">{fmt(r.line.amount)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One list of numbers per bet type, numbers merged across games and days. */
export function groupByType(rows: BetRow[]): [PredictionType, Line[]][] {
  const types = new Map<PredictionType, Map<string, Line>>();
  for (const r of rows) {
    const typeId = r.typeId as PredictionType;
    let m = types.get(typeId);
    if (!m) types.set(typeId, (m = new Map()));
    const l = m.get(r.pickedNumber);
    if (l) {
      l.bets += r.betCount;
      l.amount += r.totalStake;
    } else {
      m.set(r.pickedNumber, { number: r.pickedNumber, bets: r.betCount, amount: r.totalStake });
    }
  }
  return [...types.entries()].map(([typeId, m]): [PredictionType, Line[]] => [typeId, [...m.values()]]);
}

export function PredictionsBoard() {
  const { t } = useLang();
  // Filters, rows and results all come from the shared store, so Board and
  // Classic show the same data and switching view or tab costs no request.
  const { filters, rows, loading, error, fetchedAt, results, resultsError, games } = usePredictions();
  const { gameId, date, percent } = filters;
  const setPercent = (v: string) => setFilters({ percent: v });
  const setDay = (d: string) => setFilters({ date: d });
  const label = (typeId: string) => predictionTypeLabel(t, typeId as PredictionType);

  useEffect(() => {
    ensureAll(); // from cache when it is still fresh
  }, []);

  const updated = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
    : null;

  const pct = Number(percent);
  const pctOk = percent.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const pctUse = pctOk ? pct : 0;

  // One table per bet type, numbers merged across the selected games and days.
  const byType = useMemo(() => groupByType(rows), [rows]);

  const grandRaw = rows.reduce((s, r) => s + r.totalStake, 0);
  const grandCut = byType.reduce(
    (s, [, lines]) => s + lines.reduce((x, l) => x + (pctUse > 0 ? Math.round(l.amount * (1 - pctUse / 100)) : l.amount), 0),
    0,
  );
  const grandBets = rows.reduce((s, r) => s + r.betCount, 0);

  // With one game selected there is exactly one result to highlight against.
  const single = gameId ? results.find((r) => r.gameId === gameId) ?? null : null;
  const hitDigit = single?.openSingle ?? null;
  const declared = results.filter((r) => r.openPana || r.closePana);

  // The declared winning number of each non-Jodi type, as a picked-number string.
  // Jodi is highlighted by its open-ank group instead; the Sangams have no single winner.
  const winnerFor = (typeId: PredictionType): string | null => {
    if (!single) return null;
    const s = (n: number | null) => (n === null ? null : String(n));
    switch (typeId) {
      case 'OPEN_SINGLE':
        return s(single.openSingle);
      case 'CLOSE_SINGLE':
        return s(single.closeSingle);
      case 'OPEN_SINGLE_PANA':
      case 'OPEN_DOUBLE_PANA':
      case 'OPEN_TRIPLE_PANA':
        return single.openPana;
      case 'CLOSE_SINGLE_PANA':
      case 'CLOSE_DOUBLE_PANA':
      case 'CLOSE_TRIPLE_PANA':
        return single.closePana;
      default:
        return null;
    }
  };

  return (
    <div className="pb">
      <div className="pb-controls">
        <div className="pb-card">
          <p className="pb-card__title">Totals</p>
          <div className="pb-metric">{fmt(grandRaw)}</div>
          <div className="pb-sub">
            {grandBets.toLocaleString()} bets · {byType.length} bet type{byType.length === 1 ? '' : 's'}
            {updated && ` · updated ${updated}`}
          </div>
          <div className="pb-pct">
            <input
              className="input"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="Apply percentage"
              aria-invalid={percent.trim() !== '' && !pctOk}
            />
            <span>%</span>
          </div>
          <div className="pb-sub">
            {pctOk && pctUse > 0 ? `After −${pctUse}%: ` : 'After percentage: '}
            <strong>{fmt(grandCut)}</strong>
          </div>
          {percent.trim() !== '' && !pctOk && <div className="pb-bad">Must be between 0 and 100.</div>}
        </div>

        <div className="pb-card">
          <p className="pb-card__title">Filters</p>
          <div className="pb-label pb-label--row">
            <span>Game</span>
            <RefreshButton onClick={() => refresh()} refreshing={loading} />
          </div>
          <select className="select" value={gameId} onChange={(e) => setFilters({ gameId: e.target.value })}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <div className="pb-sub">Your players only. Every player plays at your one rate, so no odds are shown.</div>
        </div>

        <div className="pb-card">
          <p className="pb-card__title">Date</p>
          <input className="input" type="date" value={date} onChange={(e) => setDay(e.target.value)} />
          <div className="pb-buttons">
            <Button size="sm" onClick={() => setDay(dayString(0))}>
              Today
            </Button>
            <Button size="sm" onClick={() => setDay(dayString(-1))}>
              Yesterday
            </Button>
          </div>
          <div className="pb-sub">Showing {date}.</div>
        </div>

        <div className="pb-card">
          <p className="pb-card__title">Result</p>
          {resultsError ? (
            <span className="pb-bad">{resultsError}</span>
          ) : single ? (
            <>
              <div className="pb-result">
                {(['Open', 'Close'] as const).map((side) => {
                  const pana = side === 'Open' ? single.openPana : single.closePana;
                  const ank = side === 'Open' ? single.openSingle : single.closeSingle;
                  return (
                    <div className="pb-cell" key={side}>
                      <span className="pb-cell__label">{side}</span>
                      <span className="pb-cell__pana">{pana ?? '—'}</span>
                      <span className="pb-cell__ank">{ank ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
              <div className="pb-sub">
                {single.openPana || single.closePana
                  ? 'Winning numbers are highlighted in each table below'
                  : 'No result declared for this game yet.'}
              </div>
            </>
          ) : declared.length > 0 ? (
            <div className="pb-result-list">
              {declared.map((r) => (
                <div className="pb-result-row" key={r.gameId}>
                  <span>{r.gameName}</span>
                  <span className="pb-strong">
                    {r.openPana ?? '—'}-{r.openSingle ?? '—'}
                    {r.closePana ? ` / ${r.closePana}-${r.closeSingle}` : ''}
                  </span>
                </div>
              ))}
              <div className="pb-sub">Pick a game to see its result and highlight the Jodi.</div>
            </div>
          ) : (
            <span className="pb-sub">No result declared for {gameId ? 'this game' : 'any game'} on this day.</span>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : byType.length === 0 ? (
        <Empty>No bets for this selection.</Empty>
      ) : (
        <div className="pb-tables">
          {byType.map(([typeId, lines]) => (
            <TypeTable
              key={typeId}
              typeId={typeId}
              label={label(typeId)}
              lines={lines}
              pct={pctUse}
              hitDigit={hitDigit}
              winner={winnerFor(typeId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
