import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { PREDICTION_TYPE_LABEL, type AggregateRow, type PredictionType } from '../lib/types';
import { Alert, Card, CopyButton, Empty, Field, RefreshButton, TableWrap } from './ui';

const TYPE_ORDER = Object.keys(PREDICTION_TYPE_LABEL) as PredictionType[];

// Amounts are whole tokens, but a percentage cut isn't (10% of 25 is 22.5) —
// rounded to 2dp per line, and totals are the sum of those rounded lines, so
// a total can never disagree with the numbers printed above it.
const round2 = (n: number) => Math.round(n * 100) / 100;
const pretty = (n: number) => round2(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const plain = (n: number) => String(round2(n));

interface Line {
  number: string;
  bets: number;
  raw: number;
  net: number;
}

interface TypeBlock {
  typeId: PredictionType;
  lines: Line[];
  bets: number;
  rawTotal: number;
  netTotal: number;
}

interface Section {
  key: string;
  gameName: string;
  date: string;
  blocks: TypeBlock[];
}

// String order, not numeric — a picked number is a fixed-width code (a
// Jodi's "00" or a pana's "003"), not a quantity.
const byNumber = (a: Line, b: Line) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0);

function blockText(b: TypeBlock): string {
  return [
    PREDICTION_TYPE_LABEL[b.typeId],
    ...b.lines.map((l) => `${l.number} - ${plain(l.net)}`),
    `Total: ${plain(b.netTotal)}`,
  ].join('\n');
}

function sectionHeading(s: Section, pct: number | null): string {
  return `${s.gameName} — ${s.date}${pct !== null ? ` (after −${pct}%)` : ''}`;
}

function sectionText(s: Section, pct: number | null): string {
  return [sectionHeading(s, pct), '', s.blocks.map(blockText).join('\n\n')].join('\n');
}

/**
 * The Agent's book: how much its own Players have riding on each number,
 * one table per bet type with a total at the foot, filterable by game and
 * date, with a plain-text copy for pasting into a chat.
 *
 * Same data and layout as the Admin's card (`AdminPredictionsCard`) over the
 * same `GET /predictions/aggregate`, scoped server-side to this Agent's
 * Players. Two differences: no agent picker (an Agent only ever sees itself),
 * and the game dropdown lists the games that actually have bets in the
 * chosen date range — an Agent can't call `GET /games`, so the list comes
 * from the rows themselves rather than a separate fetch.
 *
 * The percentage is a display lens only, same as the Admin's: nothing is
 * stored and nothing re-queries.
 */
export function AgentPredictionsCard() {
  const [rows, setRows] = useState<AggregateRow[]>([]);
  const [gameId, setGameId] = useState('');
  const [date, setDate] = useState('');
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Game is filtered client-side (below), so changing it never refetches —
  // only the date narrows the request.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.aggregatePredictions(date ? { date } : {});
      setRows(res.rows);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const games = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.gameId, r.gameName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // A date change can drop the selected game from the list; treat that as
  // "All games" instead of showing an empty table under a stale selection.
  const activeGameId = games.some(([id]) => id === gameId) ? gameId : '';

  const pct = Number(percent);
  const pctValid = percent.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const appliedPct = pctValid ? pct : null;
  const adjust = (n: number) => (pctValid ? round2(n * (1 - pct / 100)) : n);

  const sections = useMemo<Section[]>(() => {
    const visible = activeGameId ? rows.filter((r) => r.gameId === activeGameId) : rows;
    const byKey = new Map<string, { gameName: string; date: string; rows: AggregateRow[] }>();
    for (const r of visible) {
      const key = `${r.gameId}|${r.date}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.rows.push(r);
      else byKey.set(key, { gameName: r.gameName, date: r.date, rows: [r] });
    }

    return [...byKey.entries()].map(([key, g]) => {
      const blocks: TypeBlock[] = TYPE_ORDER.flatMap((typeId) => {
        const typeRows = g.rows.filter((r) => r.typeId === typeId);
        if (typeRows.length === 0) return [];
        const lines: Line[] = typeRows
          .map((r) => ({ number: r.pickedNumber, bets: r.betCount, raw: r.totalStake, net: adjust(r.totalStake) }))
          .sort(byNumber);
        return [
          {
            typeId,
            lines,
            bets: lines.reduce((s, l) => s + l.bets, 0),
            rawTotal: lines.reduce((s, l) => s + l.raw, 0),
            netTotal: round2(lines.reduce((s, l) => s + l.net, 0)),
          },
        ];
      });
      return { key, gameName: g.gameName, date: g.date, blocks };
    });
    // adjust closes over pct/pctValid, which are derived from `percent`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeGameId, percent]);

  const grandRaw = sections.reduce((s, sec) => s + sec.blocks.reduce((t, b) => t + b.rawTotal, 0), 0);
  const grandNet = round2(sections.reduce((s, sec) => s + sec.blocks.reduce((t, b) => t + b.netTotal, 0), 0));
  const blockCount = sections.reduce((s, sec) => s + sec.blocks.length, 0);

  return (
    <>
      <Card
        title="Prediction totals"
        desc="Totals per number across your players, broken out by bet type."
        action={
          <div className="btn-row">
            <CopyButton getText={() => sections.map((s) => sectionText(s, appliedPct)).join('\n\n\n')} />
            <RefreshButton onClick={() => void load()} refreshing={loading} />
          </div>
        }
      >
        {error && <Alert tone="error">{error}</Alert>}

        <div className="form-row">
          <Field label="Game">
            <select className="select" value={activeGameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="">All games</option>
              {games.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" hint="In the game's own timezone. Blank shows every date.">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Apply a percentage cut"
          hint={
            percent.trim() === ''
              ? 'Optional. Entering 10 shows every amount at −10%. Display only — nothing is saved.'
              : pctValid
                ? `Showing amounts at −${pct}%.`
                : 'Must be between 0 and 100.'
          }
          hintTone={percent.trim() !== '' && !pctValid ? 'bad' : undefined}
        >
          <input
            className="input"
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="10"
            aria-invalid={percent.trim() !== '' && !pctValid}
          />
        </Field>

        {!loading && blockCount > 0 && (
          <div className="note">
            {blockCount} bet type{blockCount === 1 ? '' : 's'} · {pretty(grandRaw)} tokens total
            {pctValid && ` · ${pretty(grandNet)} after −${pct}%`}
          </div>
        )}
      </Card>

      {loading ? (
        <Card title="Loading…">
          <Empty>Loading…</Empty>
        </Card>
      ) : sections.length === 0 ? (
        <Card title="No predictions">
          <Empty>Nothing matches that filter.</Empty>
        </Card>
      ) : (
        sections.map((s) => (
          <div key={s.key}>
            <div className="game-section-label">
              {s.gameName} · {s.date}
            </div>
            {s.blocks.map((b) => (
              <Card
                key={b.typeId}
                title={PREDICTION_TYPE_LABEL[b.typeId]}
                desc={`${b.lines.length} number${b.lines.length === 1 ? '' : 's'} · ${pretty(b.rawTotal)} tokens${
                  pctValid ? ` · ${pretty(b.netTotal)} after −${pct}%` : ''
                }`}
                flush
                action={<CopyButton getText={() => `${sectionHeading(s, appliedPct)}\n\n${blockText(b)}`} />}
              >
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th style={{ textAlign: 'right' }}>Bets</th>
                      <th style={{ textAlign: 'right' }}>Tokens</th>
                      {pctValid && <th style={{ textAlign: 'right' }}>−{pct}%</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {b.lines.map((l) => (
                      <tr key={l.number}>
                        <td className="cell-strong cell-num">{l.number}</td>
                        <td className="cell-num" style={{ textAlign: 'right' }}>
                          {l.bets}
                        </td>
                        <td className="cell-num" style={{ textAlign: 'right' }}>
                          {pretty(l.raw)}
                        </td>
                        {pctValid && (
                          <td className="cell-num" style={{ textAlign: 'right' }}>
                            {pretty(l.net)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="cell-strong">Total</td>
                      <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>
                        {b.bets}
                      </td>
                      <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>
                        {pretty(b.rawTotal)}
                      </td>
                      {pctValid && (
                        <td className="cell-num cell-strong" style={{ textAlign: 'right' }}>
                          {pretty(b.netTotal)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </TableWrap>
              </Card>
            ))}
          </div>
        ))
      )}
    </>
  );
}
