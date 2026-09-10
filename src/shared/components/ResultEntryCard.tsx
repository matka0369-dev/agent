import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Game, SettlementSummary } from '../lib/types';
import { Alert, Button, Card, Empty, Field } from './ui';

/** Digits summed mod 10 — mirrors result-derivation.singleFromPana. */
function singleFromPana(pana: string): number {
  return [...pana].reduce((sum, d) => sum + Number(d), 0) % 10;
}

/** 3 digits, non-decreasing with '0' ordering as ten. */
function isValidPana(pana: string): boolean {
  if (!/^[0-9]{3}$/.test(pana)) return false;
  const v = [...pana].map((d) => (d === '0' ? 10 : Number(d)));
  return v[0] <= v[1] && v[1] <= v[2];
}

function panaFamilyLabel(pana: string): string {
  const [a, b, c] = [...pana];
  if (a === b && b === c) return 'Triple Pana';
  if (a === b || b === c || a === c) return 'Double Pana';
  return 'Single Pana';
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Platform Admin's result entry — the action that pays everyone.
 *
 * The operator types only the two panas; every other result (the singles,
 * the jodi, both sangams) is derived and shown back *before* submitting, so
 * a typo is visible as a wrong jodi rather than discovered afterwards in
 * someone's balance. Submitting settles immediately and irreversibly, so
 * the preview is the last checkpoint that exists.
 */
export function ResultEntryCard() {
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState('');
  const [date, setDate] = useState(todayUtc);
  const [openPana, setOpenPana] = useState('');
  const [closePana, setClosePana] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await api.listGamesAsPlatformAdmin();
      const active = all.filter((g) => g.status === 'ACTIVE');
      setGames(active);
      setGameId((prev) => (active.some((g) => g.id === prev) ? prev : (active[0]?.id ?? '')));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openValid = openPana === '' || isValidPana(openPana);
  const closeValid = closePana === '' || isValidPana(closePana);
  const openSingle = openValid && openPana ? singleFromPana(openPana) : null;
  const closeSingle = closeValid && closePana ? singleFromPana(closePana) : null;

  const canSubmit =
    !!gameId && !!date && (openPana !== '' || closePana !== '') && openValid && closeValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const summary = await api.submitGameResult(gameId, {
        date,
        ...(openPana ? { openPana } : {}),
        ...(closePana ? { closePana } : {}),
      });
      setResult(summary);
      setOpenPana('');
      setClosePana('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <Alert tone="error">{loadError}</Alert>;

  if (games.length === 0) {
    return (
      <Card title="Enter a result">
        <Empty>No active games — activate one first.</Empty>
      </Card>
    );
  }

  return (
    <Card
      title="Enter a result"
      desc="Type the panas; everything else is derived. Submitting settles every bet it decides — there's no undo."
    >
      <form onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        {result && (
          <Alert tone="success">
            Settled {result.settledCount} prediction{result.settledCount === 1 ? '' : 's'} on the{' '}
            {result.settledSide?.toLowerCase()} side — {result.wonCount} won, {result.lostCount} lost,{' '}
            {result.totalPaidOut.toLocaleString()} tokens paid out.
          </Alert>
        )}

        <div className="form-row">
          <Field label="Game">
            <select className="select" value={gameId} onChange={(e) => setGameId(e.target.value)}>
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
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="form-row">
          <Field
            label="Open pana"
            hint={
              openPana && !openValid
                ? 'Must be non-decreasing, where 0 counts as ten (368 or 100, not 012)'
                : 'Three digits. Leave blank if only entering the close result.'
            }
            hintTone={openPana && !openValid ? 'bad' : undefined}
          >
            <input
              className="input"
              inputMode="numeric"
              maxLength={3}
              value={openPana}
              onChange={(e) => setOpenPana(e.target.value.trim())}
              placeholder="368"
              aria-invalid={!!openPana && !openValid}
            />
          </Field>
          <Field
            label="Close pana"
            hint={
              closePana && !closeValid
                ? 'Must be non-decreasing, where 0 counts as ten'
                : 'Only after the open result is recorded.'
            }
            hintTone={closePana && !closeValid ? 'bad' : undefined}
          >
            <input
              className="input"
              inputMode="numeric"
              maxLength={3}
              value={closePana}
              onChange={(e) => setClosePana(e.target.value.trim())}
              placeholder="159"
              aria-invalid={!!closePana && !closeValid}
            />
          </Field>
        </div>

        {/* The checkpoint: what these panas actually mean, before anyone is
            paid. A transposed digit shows up here as a wrong jodi. */}
        {(openSingle !== null || closeSingle !== null) && (
          <div className="note" style={{ display: 'grid', gap: 4 }}>
            <strong>This will settle as:</strong>
            {openSingle !== null && (
              <span>
                Open single <b>{openSingle}</b> · open pana <b>{openPana}</b> (
                {panaFamilyLabel(openPana)})
              </span>
            )}
            {closeSingle !== null && (
              <span>
                Close single <b>{closeSingle}</b> · close pana <b>{closePana}</b> (
                {panaFamilyLabel(closePana)})
              </span>
            )}
            {openSingle !== null && closeSingle !== null && (
              <>
                <span>
                  Jodi <b>{`${openSingle}${closeSingle}`}</b>
                </span>
                <span>
                  Half sangam <b>{`${openSingle}-${closePana}`}</b> or{' '}
                  <b>{`${openPana}-${closeSingle}`}</b>
                </span>
                <span>
                  Full sangam <b>{`${openPana}-${closePana}`}</b>
                </span>
              </>
            )}
            {openSingle !== null && closeSingle === null && (
              <span className="cell-muted">
                Jodi and sangams need the close result too — they stay pending.
              </span>
            )}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
          {submitting ? 'Settling…' : 'Submit result & settle'}
        </Button>
      </form>
    </Card>
  );
}
