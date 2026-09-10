import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { UserSummary } from '../lib/types';
import { Alert, Button, Card, Empty, Field } from './ui';

/**
 * An Agent handing its own tokens to a Player, or taking them back.
 *
 * This is a **transfer, not a grant** — the tokens come out of the Agent's
 * own wallet, so the balance is shown right here and the amount is bounded
 * by it. An Agent cannot create tokens; only an Admin can (see
 * ARCHITECTURE.md's 2026-08-05 revision). Saying so on the form matters
 * because "add tokens" otherwise reads exactly like the Admin's grant,
 * which does mint.
 */
export function TransferTokensCard({
  players,
  agentBalance,
  onDone,
}: {
  players: UserSummary[];
  agentBalance: number;
  onDone: () => void;
}) {
  const [playerId, setPlayerId] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'give' | 'reclaim'>('give');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = players.find((p) => p.id === playerId) ?? null;
  const parsed = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isInteger(parsed) && parsed > 0;

  // Each direction is bounded by whoever is paying: your wallet when giving,
  // the player's when reclaiming. The server re-checks both.
  const ceiling = direction === 'give' ? agentBalance : (selected?.balance ?? 0);
  const overCeiling = amountValid && parsed > ceiling;

  const canSubmit = !!playerId && amountValid && !overCeiling;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const signed = direction === 'give' ? parsed : -parsed;
      await api.transferTokens(playerId, signed, note.trim() || undefined);
      setOkMessage(
        direction === 'give'
          ? `Sent ${parsed.toLocaleString()} to ${selected?.username}.`
          : `Reclaimed ${parsed.toLocaleString()} from ${selected?.username}.`,
      );
      setAmount('');
      setNote('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (players.length === 0) {
    return (
      <Card title="Move tokens">
        <Empty>Create a player first.</Empty>
      </Card>
    );
  }

  return (
    <Card
      title="Move tokens"
      desc={`Out of your own wallet — you hold ${agentBalance.toLocaleString()}. Only an Admin can create new tokens.`}
    >
      <form onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        {okMessage && <Alert tone="success">{okMessage}</Alert>}

        <div className="form-row">
          <Field label="Player">
            <select className="select" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Select a player…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.username} ({p.balance.toLocaleString()})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Direction">
            <select
              className="select"
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'give' | 'reclaim')}
            >
              <option value="give">Give to player</option>
              <option value="reclaim">Reclaim from player</option>
            </select>
          </Field>
        </div>

        <div className="form-row">
          <Field
            label="Amount"
            hint={
              overCeiling
                ? direction === 'give'
                  ? `You only hold ${agentBalance.toLocaleString()}.`
                  : `${selected?.username} only holds ${(selected?.balance ?? 0).toLocaleString()}.`
                : `Available: ${ceiling.toLocaleString()}`
            }
            hintTone={overCeiling ? 'bad' : undefined}
          >
            <input
              className="input"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              aria-invalid={overCeiling}
            />
          </Field>

          <Field label="Note (optional)">
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Top-up"
            />
          </Field>
        </div>

        <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
          {submitting ? 'Moving…' : direction === 'give' ? 'Send tokens' : 'Reclaim tokens'}
        </Button>
      </form>
    </Card>
  );
}
