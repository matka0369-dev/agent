import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
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

type GameState = 'upcoming' | 'open' | 'closed';

function gameState(g: ActiveGame, now: number): GameState {
  if (now < new Date(g.opensAt).getTime()) return 'upcoming';
  if (now >= new Date(g.closesAt).getTime()) return 'closed';
  return 'open';
}

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

/** Same idea as formatRemaining but readable at hour scale — used on the
 *  game cards, where "opens in 3h" beats "opens in 180m 00s". */
function formatDuration(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/**
 * The Player's betting flow, split across two routes so picking a game is a
 * real navigation rather than a selection sitting on the home screen:
 *
 * - "/"                 — the games grid (this app's home screen).
 * - "/predict/:gameId"  — that one game's bet form.
 *
 * Both share one fetch/poll of the day's games so switching between them is
 * instant and the live countdowns don't reset. Mounted by the "predict" tab
 * in Dashboard.tsx, so these paths are relative to nothing else — Player is
 * the only portal with any client-side routing.
 */
export function PredictForm({ onPlaced }: { onPlaced?: () => void }) {
  const { user } = useAuth();
  const [games, setGames] = useState<ActiveGame[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  if (loading) return <Empty>Loading games…</Empty>;
  if (loadError) return <Alert tone="error">{loadError}</Alert>;

  return (
    <Routes>
      <Route path="/" element={<GamesHome games={games} now={now} balance={balance} />} />
      <Route
        path="/predict/:gameId"
        element={
          <GameBetForm
            games={games}
            now={now}
            balance={balance}
            setBalance={setBalance}
            onPlaced={onPlaced}
          />
        }
      />
    </Routes>
  );
}

/** Home screen: browse the day's games, pick one to bet on. No form here on
 *  purpose — placing a prediction happens on its own page. */
function GamesHome({ games, now, balance }: { games: ActiveGame[]; now: number; balance: number | null }) {
  if (games.length === 0) {
    return (
      <Card title="Predict">
        <Empty>No games are open right now — check back once your Agent's Admin enables one.</Empty>
      </Card>
    );
  }

  return (
    <Card
      title="Predict"
      desc={
        balance !== null
          ? `Spendable: ${balance.toLocaleString()} tokens (main first, then winnings)`
          : undefined
      }
    >
      <div className="game-grid">
        {games.map((g) => {
          const st = gameState(g, now);
          return (
            <Link key={g.gameId} to={`/predict/${g.gameId}`} className={`game-card game-card--${st}`}>
              <div className="game-card__name">{g.name}</div>
              <div className="game-card__meta">
                {g.minStake.toLocaleString()}–{g.maxStake.toLocaleString()} tokens
              </div>
              <div className={`game-card__status game-card__status--${st}`}>
                {st === 'open' && `Open · closes in ${formatDuration(msRemaining(g.closesAt, now))}`}
                {st === 'upcoming' && `Opens in ${formatDuration(msRemaining(g.opensAt, now))}`}
                {st === 'closed' && 'Closed for today'}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/** The single-game betting page, reached by picking a card on the home
 *  screen (or a direct/bookmarked link to /predict/:gameId). */
function GameBetForm({
  games,
  now,
  balance,
  setBalance,
  onPlaced,
}: {
  games: ActiveGame[];
  now: number;
  balance: number | null;
  setBalance: (n: number) => void;
  onPlaced?: () => void;
}) {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const game = games.find((g) => g.gameId === gameId) ?? null;
  const state = game ? gameState(game, now) : null;

  const [selectedType, setSelectedType] = useState<PredictionType>('OPEN_SINGLE');
  const [pickedNumber, setPickedNumber] = useState('');
  const [stake, setStake] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const typeStates = useMemo(() => {
    const map = new Map<PredictionType, number>();
    if (!game) return map;
    for (const t of ALL_TYPES) map.set(t, msRemaining(game.cutoffs[t], now));
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

  if (!game) {
    return (
      <Card title="Predict">
        <Alert tone="error">
          That game isn't in today's list — it may have been disabled, or the link is stale.
        </Alert>
        <div style={{ marginTop: 12 }}>
          <Link to="/" className="btn btn--ghost">
            ← Back to games
          </Link>
        </div>
      </Card>
    );
  }

  const formatError = pickedNumber ? validatePickedNumber(selectedType, pickedNumber) : null;
  const selectedRemaining = typeStates.get(selectedType) ?? 0;
  const isClosedForType = selectedRemaining <= 0;

  const stakeNum = Number(stake);
  const stakeInvalid = Boolean(
    stake.trim() === '' ||
      !Number.isInteger(stakeNum) ||
      stakeNum < game.minStake ||
      stakeNum > game.maxStake,
  );

  const canSubmit = state === 'open' && !isClosedForType && !formatError && pickedNumber !== '' && !stakeInvalid;

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

  const openRemaining = msRemaining(game.cutoffs.OPEN_SINGLE, now);
  const closeRemaining = msRemaining(game.cutoffs.CLOSE_SINGLE, now);

  return (
    <Card
      title={game.name}
      desc={
        balance !== null
          ? `Spendable: ${balance.toLocaleString()} tokens (main first, then winnings)`
          : undefined
      }
      action={
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
          ← All games
        </button>
      }
    >
      {state !== 'open' && (
        <Alert tone={state === 'upcoming' ? 'info' : 'error'}>
          {state === 'upcoming'
            ? `${game.name} opens at ${new Date(game.opensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
            : `${game.name} is closed for today — check back tomorrow.`}
        </Alert>
      )}

      {state === 'open' && (
        <form onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}
          {okMessage && <Alert tone="success">{okMessage}</Alert>}

          <div className="note" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Open bets close in: {formatRemaining(openRemaining)}</span>
            <span>Close bets close in: {formatRemaining(closeRemaining)}</span>
          </div>

          {/* Shown as chips rather than a <select> so every bet type — and
              which of them are still open — is visible at a glance instead
              of hidden behind a dropdown the Player has to open first. */}
          <div className="type-chip-group">
            <div className="type-chip-group__label">Open</div>
            <div className="type-chip-row">
              {OPEN_CUTOFF_TYPES.map((t) => {
                const open = (typeStates.get(t) ?? 0) > 0;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`type-chip${selectedType === t ? ' type-chip--selected' : ''}`}
                    disabled={!open}
                    onClick={() => setSelectedType(t)}
                    title={open ? undefined : 'Closed'}
                  >
                    {PREDICTION_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="type-chip-group">
            <div className="type-chip-group__label">Close</div>
            <div className="type-chip-row">
              {CLOSE_CUTOFF_TYPES.map((t) => {
                const open = (typeStates.get(t) ?? 0) > 0;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`type-chip${selectedType === t ? ' type-chip--selected' : ''}`}
                    disabled={!open}
                    onClick={() => setSelectedType(t)}
                    title={open ? undefined : 'Closed'}
                  >
                    {PREDICTION_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

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
              hint={`Between ${game.minStake} and ${game.maxStake}`}
              hintTone={stake && stakeInvalid ? 'bad' : undefined}
            >
              <input
                className="input"
                inputMode="numeric"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder={String(game.minStake)}
                aria-invalid={Boolean(stake) && stakeInvalid}
              />
            </Field>
          </div>

          <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
            {submitting ? 'Placing…' : 'Place prediction'}
          </Button>
        </form>
      )}
    </Card>
  );
}
