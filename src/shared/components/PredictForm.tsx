import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';
import {
  CLOSE_CUTOFF_TYPES,
  OPEN_CUTOFF_TYPES,
  PREDICTION_TYPE_LABEL,
  type ActiveGame,
  type PredictionType,
} from '../lib/types';
import { PICKED_NUMBER_PLACEHOLDER, validatePickedNumber } from '../lib/predictionValidation';
import { Alert, Button, Card, Empty, Field } from './ui';

// PREDICTION_TYPE_LABEL is shared with admin-facing components (result
// entry, rate cards) that never localize, so it stays English-only there —
// this looks up the same type's name in the active language instead,
// falling back to that canonical English label.
function typeLabel(t: ReturnType<typeof useLang>['t'], type: PredictionType): string {
  return t(`type.${type}`, PREDICTION_TYPE_LABEL[type]);
}

// Half Sangam isn't offered here — Players can no longer start a new one,
// though nothing else about it changes: existing Half Sangam predictions,
// admin result entry, and rate cards are all untouched. Filtered out of the
// open-cutoff list specifically (that's the only group it belongs to) so it
// drops out of the chips, the cutoff countdown, and the "any type still
// open" check together, rather than needing three separate exclusions.
const PLAYER_OPEN_TYPES: PredictionType[] = OPEN_CUTOFF_TYPES.filter((t) => t !== 'HALF_SANGAM');
const ALL_TYPES: PredictionType[] = [...PLAYER_OPEN_TYPES, ...CLOSE_CUTOFF_TYPES];

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

/** Day vs Night, split at 6pm by open time — read in the viewer's own local
 *  time (every game here runs on Asia/Kolkata anyway, and that's who's
 *  looking at this screen). */
function isNightGame(opensAtIso: string): boolean {
  return new Date(opensAtIso).getHours() >= 18;
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
  const { t } = useLang();
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

  if (loading) return <Empty>{t('predict.loading', 'Loading games…')}</Empty>;
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

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Digit-sum of a pana, mod 10 — the "single"/ank. Mirrors core-service's
 *  singleFromPana (result-derivation.ts); duplicated rather than shared
 *  since this is the only place the Player app needs it. */
function singleFromPana(pana: string): number {
  return [...pana].reduce((sum, d) => sum + Number(d), 0) % 10;
}

/** "123-65-456" (open pana - jodi - close pana), each segment placeheld
 *  with dashes until Platform Admin enters that side of the result. The
 *  jodi itself only ever appears once both panas are in — it's derived
 *  from both, not knowable from either alone. */
function formatResult(g: ActiveGame): string {
  const open = g.openPana ?? '---';
  const close = g.closePana ?? '---';
  const jodi =
    g.openPana && g.closePana
      ? `${singleFromPana(g.openPana)}${singleFromPana(g.closePana)}`
      : '--';
  return `${open}-${jodi}-${close}`;
}

function GameTile({ g, now }: { g: ActiveGame; now: number }) {
  const { t } = useLang();
  const st = gameState(g, now);
  const night = isNightGame(g.opensAt);
  const hasResult = Boolean(g.openPana || g.closePana);
  return (
    <Link to={`/predict/${g.gameId}`} className={`game-card game-card--${st}`}>
      {/* Purely decorative, first in the DOM so the plain-flow text below
          paints over it without needing an explicit z-index. */}
      <span className="game-card__icon" aria-hidden="true">
        {night ? '🌙' : '☀️'}
      </span>
      <div className="game-card__name">{g.name}</div>
      {/* Both timings, always — the status line below already narrates
          "opens in"/"closes in" relative to now, but the actual clock
          times are what someone planning around this game wants first. */}
      <div className="game-card__times">
        {clockTime(g.opensAt)} – {clockTime(g.closesAt)}
      </div>
      <div className={`game-card__result${hasResult ? ' game-card__result--declared' : ''}`}>
        {formatResult(g)}
      </div>
      <div className={`game-card__status game-card__status--${st}`}>
        {st === 'open' &&
          t('predict.statusOpen', 'Open · closes in {t}', { t: formatDuration(msRemaining(g.closesAt, now)) })}
        {st === 'upcoming' &&
          t('predict.statusUpcoming', 'Opens in {t}', { t: formatDuration(msRemaining(g.opensAt, now)) })}
        {st === 'closed' && t('predict.statusClosedToday', 'Closed for today')}
      </div>
    </Link>
  );
}

/** Home screen: browse the day's games, pick one to bet on. No form here on
 *  purpose — placing a prediction happens on its own page. Split into Day
 *  and Night sections at 6pm open time — the two halves of the real
 *  schedule, and a long flat grid of 20 games is hard to scan otherwise. */
function GamesHome({ games, now, balance }: { games: ActiveGame[]; now: number; balance: number | null }) {
  const { t } = useLang();

  if (games.length === 0) {
    return (
      <Card>
        <Empty>
          {t('predict.noGames', "No games are open right now — check back once your Agent's Admin enables one.")}
        </Empty>
      </Card>
    );
  }

  const dayGames = games.filter((g) => !isNightGame(g.opensAt));
  const nightGames = games.filter((g) => isNightGame(g.opensAt));

  return (
    // No title here on purpose — Layout already drops "Welcome, x" for this
    // tab (see Dashboard.tsx), and every card now carries its own schedule;
    // a repeated "Predict" label above them added nothing.
    <Card>
      {balance !== null && (
        <div className="note" style={{ marginBottom: 14 }}>
          {t('predict.spendable', 'Spendable: {n} tokens (main first, then winnings)', {
            n: balance.toLocaleString(),
          })}
        </div>
      )}

      {dayGames.length > 0 && (
        <>
          <div className="game-section-label">{t('predict.day', 'Day')}</div>
          <div className="game-grid">
            {dayGames.map((g) => (
              <GameTile key={g.gameId} g={g} now={now} />
            ))}
          </div>
        </>
      )}

      {nightGames.length > 0 && (
        <>
          <div className="game-section-label">{t('predict.night', 'Night')}</div>
          <div className="game-grid">
            {nightGames.map((g) => (
              <GameTile key={g.gameId} g={g} now={now} />
            ))}
          </div>
        </>
      )}
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
  const { t } = useLang();
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
    for (const bt of ALL_TYPES) map.set(bt, msRemaining(game.cutoffs[bt], now));
    return map;
  }, [game, now]);

  // If the selected type just closed, or no type is selected yet, jump to
  // the first one still open rather than leaving a dead control selected.
  useEffect(() => {
    if (!game) return;
    const remaining = typeStates.get(selectedType) ?? 0;
    if (remaining > 0) return;
    const nextOpen = ALL_TYPES.find((bt) => (typeStates.get(bt) ?? 0) > 0);
    if (nextOpen) setSelectedType(nextOpen);
  }, [game, selectedType, typeStates]);

  if (!game) {
    return (
      <Card title={t('nav.predict', 'Predict')}>
        <Alert tone="error">
          {t('predict.notInList', "That game isn't in today's list — it may have been disabled, or the link is stale.")}
        </Alert>
        <div style={{ marginTop: 12 }}>
          <Link to="/" className="btn btn--ghost">
            ← {t('predict.backToGames', 'Back to games')}
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

  // Whether *any* type still has a live cutoff — not the same question as
  // the card's upcoming/open/closed state (see below). A round is only
  // truly done once every type's own cutoff has passed.
  const anyTypeOpen = ALL_TYPES.some((bt) => (typeStates.get(bt) ?? 0) > 0);

  const canSubmit = !isClosedForType && !formatError && pickedNumber !== '' && !stakeInvalid;

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
        t('predict.placed', 'Placed — {number} at {mult}x. New balance: {bal}.', {
          number: pickedNumber,
          mult: result.oddsMultiplier,
          bal: result.balanceAfter.toLocaleString(),
        }),
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
          ? t('predict.spendable', 'Spendable: {n} tokens (main first, then winnings)', {
              n: balance.toLocaleString(),
            })
          : undefined
      }
      action={
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
          ← {t('predict.backAllGames', 'All games')}
        </button>
      }
    >
      {!anyTypeOpen && (
        <Alert tone="error">
          {t('predict.closedForToday', '{name} is closed for today — check back tomorrow.', { name: game.name })}
        </Alert>
      )}

      {/* Informational only — never blocks the form below it. Open/Jodi/
          Sangam bets are on the *open* declaration and close a minute
          before this game's open time, so they're placeable right now,
          before the round has "opened"; Close bets stay open separately
          until a minute before close. There's no window where the card
          shows "upcoming" and the form is correctly hidden — only "closed"
          (every type's cutoff has passed) actually means no more betting. */}
      {state === 'upcoming' && anyTypeOpen && (
        <Alert tone="info">
          {t(
            'predict.opensAtInfo',
            "{name}'s open declaration is at {time} — Open/Jodi/Sangam bets close a minute before that; Close bets stay open separately.",
            {
              name: game.name,
              time: new Date(game.opensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          )}
        </Alert>
      )}

      {anyTypeOpen && (
        <form onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}
          {okMessage && <Alert tone="success">{okMessage}</Alert>}

          <div className="note" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>
              {t('predict.openBetsCloseIn', 'Open bets close in:')} {formatRemaining(openRemaining)}
            </span>
            <span>
              {t('predict.closeBetsCloseIn', 'Close bets close in:')} {formatRemaining(closeRemaining)}
            </span>
          </div>

          {/* The timer that actually matters: whichever type is selected
              below. Ticks every second (the same `now` driving the chips'
              disabled state), and is the one thing that decides whether
              Place prediction is clickable — not the two general lines
              above, which cover the game as a whole. */}
          <div
            className={
              'predict-countdown' +
              (isClosedForType
                ? ' predict-countdown--closed'
                : selectedRemaining < 60_000
                  ? ' predict-countdown--warn'
                  : '')
            }
          >
            <span>{typeLabel(t, selectedType)}:</span>
            <span className="predict-countdown__time">
              {isClosedForType
                ? t('predict.closedForRound', 'Closed for this round')
                : `${formatRemaining(selectedRemaining)} ${t('predict.left', 'left')}`}
            </span>
          </div>

          {/* Shown as chips rather than a <select> so every bet type — and
              which of them are still open — is visible at a glance instead
              of hidden behind a dropdown the Player has to open first. */}
          <div className="type-chip-group">
            <div className="type-chip-group__label">{t('predict.openGroup', 'Open')}</div>
            <div className="type-chip-row">
              {PLAYER_OPEN_TYPES.map((bt) => {
                const open = (typeStates.get(bt) ?? 0) > 0;
                return (
                  <button
                    key={bt}
                    type="button"
                    className={`type-chip${selectedType === bt ? ' type-chip--selected' : ''}`}
                    disabled={!open}
                    onClick={() => setSelectedType(bt)}
                    title={open ? undefined : t('predict.closedForRound', 'Closed for this round')}
                  >
                    {typeLabel(t, bt)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="type-chip-group">
            <div className="type-chip-group__label">{t('predict.closeGroup', 'Close')}</div>
            <div className="type-chip-row">
              {CLOSE_CUTOFF_TYPES.map((bt) => {
                const open = (typeStates.get(bt) ?? 0) > 0;
                return (
                  <button
                    key={bt}
                    type="button"
                    className={`type-chip${selectedType === bt ? ' type-chip--selected' : ''}`}
                    disabled={!open}
                    onClick={() => setSelectedType(bt)}
                    title={open ? undefined : t('predict.closedForRound', 'Closed for this round')}
                  >
                    {typeLabel(t, bt)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-row">
            <Field
              label={t('predict.yourPick', 'Your pick')}
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
              label={t('predict.stake', 'Stake')}
              hint={t('predict.stakeHint', 'Between {min} and {max}', {
                min: game.minStake,
                max: game.maxStake,
              })}
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
            {submitting
              ? t('predict.placing', 'Placing…')
              : isClosedForType
                ? t('predict.timeUp', 'Time is up for this type')
                : t('predict.placePrediction', 'Place prediction')}
          </Button>
        </form>
      )}
    </Card>
  );
}
