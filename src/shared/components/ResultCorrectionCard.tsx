import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { CorrectionSummary, Game, ResultCorrectionEntry } from '../lib/types';
import { Alert, Button, Card, Empty, Field, RefreshButton, TableWrap, formatDate } from './ui';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Replacing a result that was already published and paid out.
 *
 * Separate from ResultEntryCard on purpose — a plain submission still
 * refuses to overwrite a recorded pana with a 409, and that's correct: this
 * is the deliberate, slower path for when the recorded one was simply
 * wrong. It reverses every payout the wrong result caused (a Player who
 * already spent those winnings is allowed to go negative — the claw-back is
 * the honest record, not a reason to refuse it), resets the affected
 * predictions, and re-grades from scratch. Nothing is deleted: the ledger
 * keeps both the original payout and the compensating reversal.
 */
export function ResultCorrectionCard() {
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState('');
  const [date, setDate] = useState(todayUtc);
  const [openPana, setOpenPana] = useState('');
  const [closePana, setClosePana] = useState('');
  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CorrectionSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [history, setHistory] = useState<ResultCorrectionEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await api.listGamesAsPlatformAdmin();
      setGames(all);
      setGameId((prev) => (all.some((g) => g.id === prev) ? prev : (all[0]?.id ?? '')));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = useCallback(async () => {
    if (!gameId) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await api.gameCorrections(gameId));
      setHistoryError(null);
    } catch (e) {
      setHistoryError(e instanceof ApiError ? e.message : String(e));
    }
  }, [gameId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const panaValid = (p: string) => {
    if (!/^[0-9]{3}$/.test(p)) return false;
    const v = [...p].map((d) => (d === '0' ? 10 : Number(d)));
    return v[0] <= v[1] && v[1] <= v[2];
  };
  const openValid = openPana === '' || panaValid(openPana);
  const closeValid = closePana === '' || panaValid(closePana);
  const canSubmit = !!gameId && !!date && (openPana !== '' || closePana !== '') && openValid && closeValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const summary = await api.correctGameResult(gameId, {
        date,
        ...(openPana ? { openPana } : {}),
        ...(closePana ? { closePana } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setResult(summary);
      setOpenPana('');
      setClosePana('');
      setReason('');
      setConfirming(false);
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <Alert tone="error">{loadError}</Alert>;

  if (games.length === 0) {
    return (
      <Card title="Correct a result">
        <Empty>No games yet.</Empty>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Correct a result"
        desc="For a result already published and paid out. Reverses the affected payouts (a Player may go negative if they've already spent them) and re-grades from scratch — there is no in-place edit."
      >
        <form onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}
          {result && (
            <Alert tone="success">
              {result.previousOpenPana ?? '—'}/{result.previousClosePana ?? '—'} → {result.openPana ?? '—'}/
              {result.closePana ?? '—'}. Reset {result.predictionsReset} prediction
              {result.predictionsReset === 1 ? '' : 's'}, clawed back{' '}
              {result.payoutsReversed.toLocaleString()} tokens
              {result.accountsLeftNegative > 0
                ? `, leaving ${result.accountsLeftNegative} account${result.accountsLeftNegative === 1 ? '' : 's'} negative`
                : ''}
              . Re-graded: {result.wonCount} won, {result.lostCount} lost,{' '}
              {result.totalPaidOut.toLocaleString()} tokens paid out.
            </Alert>
          )}

          <div className="form-row">
            <Field label="Game">
              <select
                className="select"
                value={gameId}
                onChange={(e) => {
                  setGameId(e.target.value);
                  setConfirming(false);
                }}
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setConfirming(false);
                }}
                required
              />
            </Field>
          </div>

          <div className="form-row">
            <Field label="Corrected open pana" hint="Leave blank to keep the recorded one.">
              <input
                className="input"
                inputMode="numeric"
                maxLength={3}
                value={openPana}
                onChange={(e) => {
                  setOpenPana(e.target.value.trim());
                  setConfirming(false);
                }}
                placeholder="368"
                aria-invalid={!!openPana && !openValid}
              />
            </Field>
            <Field label="Corrected close pana" hint="Leave blank to keep the recorded one.">
              <input
                className="input"
                inputMode="numeric"
                maxLength={3}
                value={closePana}
                onChange={(e) => {
                  setClosePana(e.target.value.trim());
                  setConfirming(false);
                }}
                placeholder="159"
                aria-invalid={!!closePana && !closeValid}
              />
            </Field>
          </div>

          <Field label="Reason (optional, but it's the only place the why is recorded)">
            <input
              className="input"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setConfirming(false);
              }}
              placeholder="Transposed digits at entry"
            />
          </Field>

          {confirming && (
            <Alert tone="info">
              This un-pays every winner the current result created and re-grades the round. Submit
              again to confirm.
            </Alert>
          )}

          <Button type="submit" variant="danger" disabled={!canSubmit || submitting}>
            {submitting ? 'Correcting…' : confirming ? 'Confirm correction' : 'Correct result'}
          </Button>
        </form>
      </Card>

      <Card
        title="Correction history"
        desc="Every time a result for this game was replaced."
        flush
        action={<RefreshButton onClick={() => void loadHistory()} />}
      >
        {historyError && (
          <div style={{ padding: '16px 16px 0' }}>
            <Alert tone="error">{historyError}</Alert>
          </div>
        )}
        {history.length === 0 ? (
          <Empty>No corrections on this game.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Date</th>
                <th>Was</th>
                <th>Became</th>
                <th style={{ textAlign: 'right' }}>Reset</th>
                <th style={{ textAlign: 'right' }}>Reversed</th>
                <th style={{ textAlign: 'right' }}>Went negative</th>
                <th>Reason</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="cell-muted">{h.date}</td>
                  <td>
                    {h.previousOpenPana ?? '—'}/{h.previousClosePana ?? '—'}
                  </td>
                  <td>
                    {h.newOpenPana ?? '—'}/{h.newClosePana ?? '—'}
                  </td>
                  <td className="cell-num">{h.predictionsReset}</td>
                  <td className="cell-num">{h.payoutsReversed.toLocaleString()}</td>
                  <td className="cell-num">{h.accountsLeftNegative}</td>
                  <td className="cell-muted">{h.reason ?? '—'}</td>
                  <td className="cell-muted">{h.performedBy.username}</td>
                  <td className="cell-muted">{formatDate(h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
