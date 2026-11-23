import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Field, predictionTypeLabel, useLang, type PredictionType, type UserSummary } from './shared';
import { opsApi } from './opsApi';
import type { BetRow } from './consolidate';
import { dayString } from './predictionsStore';
import { fmt, groupByType, TypeTable } from './PredictionsBoard';
import './predictionsBoard.css';

// The last look is kept for the life of the page, so coming back to the tab
// shows it again instead of fetching it again. Re-fetched only on a change of
// player or dates, after five minutes, or on Refresh.
const FRESH_MS = 5 * 60_000;
let last: { playerId: string; from: string; to: string; rows: BetRow[]; at: number } | null = null;
let lastSelection = { playerId: '', from: dayString(0), to: dayString(0) };

/**
 * One player's bets, added up per number, over a date range. The Predictions
 * tab is one day at a time across all players; looking at a single player over
 * several days is what this card is for.
 */
export function PlayerPredictions({ players }: { players: UserSummary[] }) {
  const { t } = useLang();
  const [playerId, setPlayerId] = useState(lastSelection.playerId);
  const [from, setFrom] = useState(lastSelection.from);
  const [to, setTo] = useState(lastSelection.to);
  const [rows, setRows] = useState<BetRow[]>(last && last.playerId === lastSelection.playerId ? last.rows : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    if (!playerId) return;
    if (!force && last && last.playerId === playerId && last.from === from && last.to === to && Date.now() - last.at < FRESH_MS) {
      setRows(last.rows);
      return;
    }
    setLoading(true);
    try {
      const res = await opsApi.aggregate({ playerId, from, to });
      last = { playerId, from, to, rows: res.rows, at: Date.now() };
      setRows(res.rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    lastSelection = { playerId, from, to };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, from, to]);

  const byType = useMemo(() => groupByType(rows), [rows]);
  const totalBets = rows.reduce((s, r) => s + r.betCount, 0);
  const totalTokens = rows.reduce((s, r) => s + r.totalStake, 0);
  const label = (typeId: string) => predictionTypeLabel(t, typeId as PredictionType);
  const picked = players.find((p) => p.id === playerId);

  // A cleared date goes back to today; the range is never left backwards.
  const setFromSafe = (v: string) => {
    const d = v.trim() || dayString(0);
    setFrom(d);
    if (d > to) setTo(d);
  };
  const setToSafe = (v: string) => {
    const d = v.trim() || dayString(0);
    setTo(d);
    if (d < from) setFrom(d);
  };
  const range = (days: number) => {
    setFrom(dayString(-days));
    setTo(dayString(0));
  };

  return (
    <>
      <Card title="Player predictions" desc="One player's bets over a range of days, added up per number.">
        <div className="btn-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <Field label="Player">
            <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Choose a player…</option>
              {[...players].sort((a, b) => a.username.localeCompare(b.username)).map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input className="input" type="date" value={from} max={to} onChange={(e) => setFromSafe(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} min={from} onChange={(e) => setToSafe(e.target.value)} />
          </Field>
          <div className="btn-row">
            <Button onClick={() => range(0)}>Today</Button>
            <Button onClick={() => range(6)}>Last 7 days</Button>
            <Button onClick={() => range(29)}>Last 30 days</Button>
            <Button onClick={() => void load(true)} disabled={!playerId || loading}>Refresh</Button>
          </div>
        </div>
        {picked && !loading && rows.length > 0 && (
          <p className="pb-sub" style={{ marginTop: 10 }}>
            {picked.username}: {totalBets.toLocaleString()} bets · {fmt(totalTokens)} tokens · {from === to ? from : `${from} to ${to}`}
          </p>
        )}
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {!playerId ? (
        <Card><Empty>Choose a player to see their bets.</Empty></Card>
      ) : loading ? (
        <Card><Empty>Loading…</Empty></Card>
      ) : byType.length === 0 ? (
        <Card><Empty>No bets from this player in this range.</Empty></Card>
      ) : (
        <div className="pb pb-tables">
          {byType.map(([typeId, lines]) => (
            <TypeTable key={typeId} typeId={typeId} label={label(typeId)} lines={lines} pct={0} hitDigit={null} winner={null} />
          ))}
        </div>
      )}
    </>
  );
}
