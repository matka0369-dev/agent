import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import {
  CLOSE_CUTOFF_TYPES,
  OPEN_CUTOFF_TYPES,
  PREDICTION_TYPE_LABEL,
  type ActiveGame,
  type PredictionType,
} from '../lib/types';
import { PICKED_NUMBER_PLACEHOLDER, validatePickedNumber } from '../lib/predictionValidation';
import { Alert, Button, Card, Empty, Field } from './ui';

const ALL_TYPES: PredictionType[] = [...OPEN_CUTOFF_TYPES, ...CLOSE_CUTOFF_TYPES];

function msRemaining(iso: string, now: number): number {
  return new Date(iso).getTime() - now;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'closed';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// The Player's betting UI — the third, independent layer of the
// triple-layer cutoff/format check (a Go-service check and a DB
// trigger/CHECK constraint are the other two; see ARCHITECTURE.md and
// lib/predictionValidation.ts). Every game a Player's Agent's Admin has
// enabled, today's round, live per-side countdowns, and the odds that will
// actually apply — pulled from prediction-service/Go, which already
// resolves all of that server-side.
export function PredictForm({ onPlaced }: { onPlaced?: () => void }) {
  const { user } = useAuth();
  const [games, setGames] = useState<ActiveGame[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<PredictionType>('OPEN_SINGLE');
  const [pickedNumber, setPickedNumber] = useState('');
  const [stake, setStake] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [activeGames, me] = await Promise.all([
        api.activeGames(),
        user ? api.getUser(user.id) : Promise.resolve(null),
      ]);
      setGames(activeGames);
      // Spendable total: a bet draws down main first and falls through to
      // winnings, so what matters here is the combined figure.
      if (me) setBalance(me.balance + me.winningsBalance);
      setLoadError(null);
      setSelectedGameId((prev) => (activeGames.some((g) => g.gameId === prev) ? prev : (activeGames[0]?.gameId ?? '')));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ticks the countdown and re-evaluates which controls are still open —
  // the UI-layer half of "disable a control once its cutoff passes."
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const game = games.find((g) => g.gameId === selectedGameId) ?? null;

  const typeStates = useMemo(() => {
    if (!game) return new Map<PredictionType, number>();
    const map = new Map<PredictionType, number>();
    for (const t of ALL_TYPES) {
      map.set(t, msRemaining(game.cutoffs[t], now));
    }
    return map;
  }, [game, now]);

  // If the selected type just closed, or no type is selected yet, jump to
  // the first one still open rather than leaving a dead control selected.
  useEffect(() => {
    if (!game) return;
    const remaining = typeStates.get(selectedType) ?? 0;
    if (remaining > 0) return;
    const nextOpen = ALL_TYPES.find((t) => (typeStates.get(t) ?? 0) > 0);
    if (nextOpen) setSelectedType(nextOpen);
  }, [game, selectedType, typeStates]);

  const formatError = pickedNumber ? validatePickedNumber(selectedType, pickedNumber) : null;
  const selectedRemaining = typeStates.get(selectedType) ?? 0;
  const isClosedForType = selectedRemaining <= 0;

  const stakeNum = Number(stake);
  const stakeInvalid = Boolean(
    stake.trim() === '' ||
      !Number.isInteger(stakeNum) ||
      (game && (stakeNum < game.minStake || stakeNum > game.maxStake)),
  );

  const canSubmit = Boolean(game) && !isClosedForType && !formatError && pickedNumber !== '' && !stakeInvalid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!game) return;
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const result = await api.placePrediction({
        gameId: game.gameId,
        typeId: selectedType,
        pickedNumber,
        stake: stakeNum,
      });
      setOkMessage(
        `Placed — ${pickedNumber} at ${result.oddsMultiplier}x. New balance: ${result.balanceAfter.toLocaleString()}.`,
      );
      setBalance(result.balanceAfter);
      setPickedNumber('');
      setStake('');
      onPlaced?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Empty>Loading games…</Empty>;
  if (loadError) return <Alert tone="error">{loadError}</Alert>;

  if (games.length === 0) {
    return (
      <Card title="Predict">
        <Empty>No games are open right now — check back once your Agent's Admin enables one.</Empty>
      </Card>
    );
  }

  const openRemaining = game ? msRemaining(game.cutoffs.OPEN_SINGLE, now) : 0;
  const closeRemaining = game ? msRemaining(game.cutoffs.CLOSE_SINGLE, now) : 0;

  return (
    <Card
      title="Predict"
      desc={
        balance !== null
          ? `Spendable: ${balance.toLocaleString()} tokens (main first, then winnings)`
          : undefined
      }
    >
      <form onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        {okMessage && <Alert tone="success">{okMessage}</Alert>}

        <Field label="Game">
          <select
            className="select"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
          >
            {games.map((g) => (
              <option key={g.gameId} value={g.gameId}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        {game && (
          <div className="note" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Open bets close in: {formatRemaining(openRemaining)}</span>
            <span>Close bets close in: {formatRemaining(closeRemaining)}</span>
          </div>
        )}

        <Field label="Bet type">
          <select
            className="select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as PredictionType)}
          >
            <optgroup label="Open">
              {OPEN_CUTOFF_TYPES.map((t) => (
                <option key={t} value={t} disabled={(typeStates.get(t) ?? 0) <= 0}>
                  {PREDICTION_TYPE_LABEL[t]} {(typeStates.get(t) ?? 0) <= 0 ? '(closed)' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Close">
              {CLOSE_CUTOFF_TYPES.map((t) => (
                <option key={t} value={t} disabled={(typeStates.get(t) ?? 0) <= 0}>
                  {PREDICTION_TYPE_LABEL[t]} {(typeStates.get(t) ?? 0) <= 0 ? '(closed)' : ''}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>

        {isClosedForType && <Alert tone="error">Betting for this type has closed.</Alert>}

        <div className="form-row">
          <Field
            label="Your pick"
            hint={formatError ?? `e.g. ${PICKED_NUMBER_PLACEHOLDER[selectedType]}`}
            hintTone={formatError ? 'bad' : undefined}
          >
            <input
              className="input"
              value={pickedNumber}
              onChange={(e) => setPickedNumber(e.target.value.trim())}
              placeholder={PICKED_NUMBER_PLACEHOLDER[selectedType]}
              aria-invalid={Boolean(formatError)}
            />
          </Field>

          <Field
            label="Stake"
            hint={game ? `Between ${game.minStake} and ${game.maxStake}` : undefined}
            hintTone={stake && stakeInvalid ? 'bad' : undefined}
          >
            <input
              className="input"
              inputMode="numeric"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder={game ? String(game.minStake) : ''}
              aria-invalid={Boolean(stake) && stakeInvalid}
            />
          </Field>
        </div>

        <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
          {submitting ? 'Placing…' : 'Place prediction'}
        </Button>
      </form>
    </Card>
  );
}
