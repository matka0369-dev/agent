import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { AccountType, RateMeta, Role, UserSummary } from '../lib/types';
import { Alert, Button, Card, Field, TableWrap } from './ui';

// Profit/loss shares are in tenths, so 9:1 Admin:Agent is agentShare = 1.
const PROFIT_SHARE_TOTAL = 10;

const MIN_CHECK_LENGTH = 4;
// Pre-checked when creating a staff account (ADMIN_STAFF/AGENT_STAFF),
// because a staff account with zero roles can't do anything — its authority
// is entirely delegated, unlike the native tier that created it, which needs
// no role at all. That dead-account state is easy to create by accident and
// easy to mistake for a bug, so the common case is the default.
const DEFAULT_ADMIN_ROLE = 'User Manager';

type Creatable = Extract<AccountType, 'ADMIN' | 'AGENT' | 'PLAYER' | 'ADMIN_STAFF' | 'AGENT_STAFF'>;

const ACCOUNT_TYPE_OPTION_LABEL: Record<Creatable, string> = {
  ADMIN: 'Admin',
  AGENT: 'Agent',
  PLAYER: 'Player',
  ADMIN_STAFF: 'Staff',
  AGENT_STAFF: 'Staff',
};
type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'error';

export function CreateUserForm({
  allowedTypes,
  roles,
  onCreated,
}: {
  allowedTypes: Creatable[];
  /** Only meaningful when 'ADMIN_STAFF' or 'AGENT_STAFF' is a creatable type. */
  roles?: Role[];
  onCreated: (user: UserSummary) => void;
}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<Creatable>(allowedTypes[0]);
  const [agentShare, setAgentShare] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<Availability>('idle');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom rate card for a new Agent or Player — off by default, meaning
  // "inherit the tier default as-is" (an Agent's creating Admin's current
  // default card, or a Player's Agent's current giving rates, tracked live).
  // Switching it on replaces that with an explicit, fully-specified card:
  // every bet type priced, not just one number.
  const [useCustomRates, setUseCustomRates] = useState(false);
  const [rateMeta, setRateMeta] = useState<RateMeta | null>(null);
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  const [rateLoadError, setRateLoadError] = useState<string | null>(null);

  // Funding an account at creation is the same authority as funding it later,
  // so the field only appears for a caller who actually holds it. A native
  // Admin's token authority is intrinsic (no permission needed); its staff
  // needs token:administer explicitly. The server enforces this
  // independently — hiding it just avoids offering a 403.
  const { user } = useAuth();
  const canFund =
    user?.accountType === 'ADMIN' || (user?.permissions.includes('token:administer') ?? false);

  // Seed the default once roles arrive (they load asynchronously).
  useEffect(() => {
    if (!roles) return;
    const preset = roles.find((r) => r.name === DEFAULT_ADMIN_ROLE);
    if (preset) setRoleIds(new Set([preset.id]));
  }, [roles]);

  // Loaded lazily, once, the first time the toggle is switched on — pulls in
  // the bet-type list plus the caller's own current rates as the starting
  // point for each row: an Admin's DEFAULT card for a new Agent, or an
  // Agent's GIVING card for a new Player. These are only a starting point,
  // not a ceiling — the per-row cap was removed 2026-08-05 along with the
  // server-side one (see ARCHITECTURE.md's giving-cap revision).
  useEffect(() => {
    if (!useCustomRates || rateMeta) return;
    (async () => {
      try {
        const [meta, mine] = await Promise.all([api.rateMeta(), api.myRates()]);
        setRateMeta(meta);
        const current = mine.kind === 'ADMIN' ? mine.default : mine.kind === 'AGENT' ? mine.giving : [];
        const byType = new Map(current.map((r) => [r.betType, r.multiplier]));
        setRateDraft(
          Object.fromEntries(
            meta.betTypes.map(({ betType }) => [betType, String(byType.get(betType) ?? '')]),
          ),
        );
      } catch (e) {
        setRateLoadError(e instanceof ApiError ? e.message : String(e));
      }
    })();
  }, [useCustomRates, rateMeta]);

  const rateRows =
    rateMeta?.betTypes.map(({ betType, label }) => {
      const raw = rateDraft[betType] ?? '';
      const parsed = Number(raw);
      const valid = raw.trim() !== '' && Number.isInteger(parsed) && parsed >= 1;
      return { betType, label, raw, parsed, valid };
    }) ?? [];
  const ratesInvalid = useCustomRates && (rateRows.length === 0 || rateRows.some((r) => !r.valid));

  function toggleRole(id: string) {
    setRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Debounced availability probe. Advisory only — the create call re-checks
  // server-side, which is what actually prevents duplicates under a race.
  useEffect(() => {
    if (username.length < MIN_CHECK_LENGTH) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const timer = setTimeout(async () => {
      try {
        const { available } = await api.checkUsername(username);
        setAvailability(available ? 'free' : 'taken');
      } catch {
        setAvailability('error');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const created = await api.createUser({
        email,
        username,
        password,
        accountType,
        ...((accountType === 'ADMIN_STAFF' || accountType === 'AGENT_STAFF') && roleIds.size
          ? { roleIds: [...roleIds] }
          : {}),
        ...(accountType === 'AGENT' && agentShare.trim() !== ''
          ? { agentShare: Number(agentShare) }
          : {}),
        ...((accountType === 'AGENT' || accountType === 'PLAYER') && useCustomRates
          ? { rates: rateRows.map((r) => ({ betType: r.betType, multiplier: r.parsed })) }
          : {}),
        ...(canFund && openingBalance.trim() !== ''
          ? { openingBalance: Number(openingBalance) }
          : {}),
      });
      onCreated(created);
      setOkMessage(
        created.balance > 0
          ? `Created ${created.username} with ${created.balance.toLocaleString()} tokens.`
          : `Created ${created.username}.`,
      );
      setEmail('');
      setUsername('');
      setPassword('');
      setAgentShare('');
      setOpeningBalance('');
      setAvailability('idle');
      setUseCustomRates(false);
      setRateMeta(null);
      setRateDraft({});
      setRateLoadError(null);
      const preset = roles?.find((r) => r.name === DEFAULT_ADMIN_ROLE);
      setRoleIds(preset ? new Set([preset.id]) : new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // One contextual hint rather than a static line plus a live one stacked
  // under it: while the field is blank it explains the field, and once
  // there's a value it just shows the resulting split.
  const agentShareHint = (() => {
    if (agentShare.trim() === '') {
      return {
        text: `Out of ${PROFIT_SHARE_TOTAL}. Blank inherits your default.`,
        tone: undefined as 'ok' | 'bad' | undefined,
      };
    }
    const n = Number(agentShare);
    if (!Number.isInteger(n) || n < 0 || n > PROFIT_SHARE_TOTAL) {
      return {
        text: `Must be a whole number between 0 and ${PROFIT_SHARE_TOTAL}.`,
        tone: 'bad' as const,
      };
    }
    return {
      text: `You bear ${PROFIT_SHARE_TOTAL - n}, the agent bears ${n}.`,
      tone: undefined as 'ok' | 'bad' | undefined,
    };
  })();

  const agentShareInvalid = accountType === 'AGENT' && agentShareHint.tone === 'bad';

  const hint = {
    idle: undefined,
    checking: 'Checking availability…',
    free: 'Available',
    taken: 'Already taken',
    error: 'Could not check right now',
  }[availability];

  const hintTone = availability === 'free' ? 'ok' : availability === 'taken' ? 'bad' : undefined;

  return (
    <Card title="Create account" desc={`Creates ${allowedTypes.join(' / ').toLowerCase()} accounts.`}>
      <form onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        {okMessage && <Alert tone="success">{okMessage}</Alert>}

        <div className="form-row">
          <Field label="Username" hint={hint} hintTone={hintTone}>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              required
              autoComplete="off"
              placeholder="jane_doe"
            />
          </Field>

          <Field label="Email">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              placeholder="jane@example.com"
            />
          </Field>
        </div>

        <div className="form-row">
          <Field label="Temporary password" hint="At least 8 characters.">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>

          <Field label="Account type">
            <select
              className="select"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as Creatable)}
            >
              {allowedTypes.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_OPTION_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Roles exist only for staff delegation — a native account (Admin,
            Agent) never holds one; its authority is intrinsic to the tier.
            Only ADMIN_STAFF/AGENT_STAFF, which have no authority of their
            own, need this. There's no edit step after creation, so this is
            the only chance to get it right. */}
        {(accountType === 'ADMIN_STAFF' || accountType === 'AGENT_STAFF') &&
          roles &&
          roles.length > 0 && (
            <Field label="Roles" hint="What this staff account can do — fixed at creation.">
              <div className="checkbox-list">
                {roles.map((r) => (
                  <label key={r.id} className="checkbox-list__item">
                    <input
                      type="checkbox"
                      checked={roleIds.has(r.id)}
                      onChange={() => toggleRole(r.id)}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
              {roleIds.size === 0 && (
                <Alert tone="info">
                  No roles selected — this account will sign in but won't be able to do anything
                  until a role is granted.
                </Alert>
              )}
            </Field>
          )}

        {/* An Agent's profit/loss slice, fixed at creation. Left blank it
            inherits your configured default, so the common case needs no
            input at all. */}
        {accountType === 'AGENT' && (
          <Field
            label="Agent profit share"
            hint={agentShareHint.text}
            hintTone={agentShareHint.tone}
          >
            <input
              className="input"
              inputMode="numeric"
              value={agentShare}
              onChange={(e) => setAgentShare(e.target.value)}
              placeholder="inherit default"
              aria-invalid={agentShareHint.tone === 'bad'}
            />
          </Field>
        )}

        {/* Left off, the new account inherits the tier default as-is — the
            common case needs no input: an Agent inherits your current
            default card, a Player plays at whatever you currently give
            (tracked live, changes if you edit your giving rates later).
            Switched on, every bet type must be priced explicitly: a
            half-specified card would silently mix explicit and inherited
            values, which is the exact ambiguity this option exists to
            remove. */}
        {(accountType === 'AGENT' || accountType === 'PLAYER') && (
          <Field
            label="Rates"
            hint={
              accountType === 'AGENT'
                ? 'Leave off to inherit your current default card as-is.'
                : 'Leave off to play at whatever you currently give — updates live if you change your giving rates later.'
            }
          >
            <label className="checkbox-list__item">
              <input
                type="checkbox"
                checked={useCustomRates}
                onChange={(e) => setUseCustomRates(e.target.checked)}
              />
              <span>Set custom rates for this {accountType === 'AGENT' ? 'agent' : 'player'}</span>
            </label>
          </Field>
        )}

        {(accountType === 'AGENT' || accountType === 'PLAYER') && useCustomRates && (
          <>
            {rateLoadError && <Alert tone="error">{rateLoadError}</Alert>}
            {rateRows.length > 0 && (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Bet type</th>
                    <th style={{ textAlign: 'right' }}>Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {rateRows.map((r) => (
                    <tr key={r.betType}>
                      <td className="cell-strong">{r.label}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          className="input input--rate"
                          inputMode="numeric"
                          value={r.raw}
                          aria-label={`${r.label} multiplier`}
                          aria-invalid={!r.valid}
                          onChange={(e) =>
                            setRateDraft((d) => ({ ...d, [r.betType]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </>
        )}

        {/* Opening balance is the same authority as granting later, so this
            only renders for a caller that holds it. */}
        {canFund && (
          <Field
            label="Opening token balance"
            hint="Optional. Recorded as an audited grant in the same transaction as the account."
          >
            <input
              className="input"
              inputMode="numeric"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0"
            />
          </Field>
        )}

        {/* A Player has exactly one possible Agent — whichever Agent is
            creating it — so there's nothing to pick. Stated outright rather
            than left implicit, since every other creatable type here does
            show a relationship field of some kind. */}
        {accountType === 'PLAYER' && (
          <Alert tone="info">This player will belong to you.</Alert>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={submitting || availability === 'taken' || agentShareInvalid || ratesInvalid}
        >
          {submitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </Card>
  );
}
