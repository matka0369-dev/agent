import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { TOKEN_REQUEST_KIND_LABEL, type TokenRequest, type TokenRequestKind } from '../lib/types';
import { Alert, Button, Card, Empty, Field, TableWrap, formatDate } from './ui';

function statusBadgeClass(status: TokenRequest['status']) {
  if (status === 'APPROVED') return 'badge badge--ok';
  if (status === 'PENDING') return 'badge badge--muted';
  return 'badge badge--off'; // REJECTED, CANCELLED
}

/**
 * A Player asking their Agent (top-up) or an Admin (surrender) for a
 * balance change, entirely inside the system.
 *
 * Deliberately just an amount and a note — no attachment, no external
 * reference number. A request describes what you want to happen to tokens
 * you already have standing in this ledger; it is never evidence of
 * something that happened outside it. See ARCHITECTURE.md "Hard safety
 * boundaries" — that boundary is why this form doesn't grow a file picker.
 */
export function TokenRequestsCard({
  mainBalance,
  winningsBalance,
  onChanged,
}: {
  mainBalance: number;
  winningsBalance: number;
  onChanged?: () => void;
}) {
  const [requests, setRequests] = useState<TokenRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState<TokenRequestKind>('TOP_UP');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await api.myTokenRequests());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const held = mainBalance + winningsBalance;
  const parsed = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isInteger(parsed) && parsed > 0;
  const overHeld = kind === 'SURRENDER' && amountValid && parsed > held;
  const hasOpenOfKind = requests.some((r) => r.kind === kind && r.status === 'PENDING');
  const canSubmit = amountValid && !overHeld && !hasOpenOfKind;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      await api.createTokenRequest({ kind, amount: parsed, note: note.trim() || undefined });
      setOkMessage(
        kind === 'TOP_UP'
          ? `Asked your Agent for ${parsed.toLocaleString()} tokens.`
          : `Offered to give up ${parsed.toLocaleString()} tokens.`,
      );
      setAmount('');
      setNote('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    setCancellingId(id);
    setError(null);
    try {
      await api.cancelTokenRequest(id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Ask for a balance change"
        desc="Goes to your Agent (top-up) or an Admin (surrender) to review — nothing moves until they approve it."
      >
        <form onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}
          {okMessage && <Alert tone="success">{okMessage}</Alert>}
          {hasOpenOfKind && (
            <Alert tone="info">
              You already have a pending {TOKEN_REQUEST_KIND_LABEL[kind].toLowerCase()} request —
              cancel it below before raising another of the same kind.
            </Alert>
          )}

          <div className="form-row">
            <Field label="What do you need">
              <select
                className="select"
                value={kind}
                onChange={(e) => setKind(e.target.value as TokenRequestKind)}
              >
                <option value="TOP_UP">More tokens (top-up)</option>
                <option value="SURRENDER">Give tokens back (surrender)</option>
              </select>
            </Field>
            <Field
              label="Amount"
              hint={
                overHeld
                  ? `You only hold ${held.toLocaleString()}.`
                  : kind === 'SURRENDER'
                    ? `You hold ${held.toLocaleString()} across both wallets.`
                    : undefined
              }
              hintTone={overHeld ? 'bad' : undefined}
            >
              <input
                className="input"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                aria-invalid={overHeld}
              />
            </Field>
          </div>

          <Field label="Note (optional)">
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === 'TOP_UP' ? 'Running low' : 'Don’t need these anymore'}
            />
          </Field>

          <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </form>
      </Card>

      <Card title="Your requests" flush>
        {loadError && (
          <div style={{ padding: '16px 16px 0' }}>
            <Alert tone="error">{loadError}</Alert>
          </div>
        )}
        {loading ? (
          <Empty>Loading…</Empty>
        ) : requests.length === 0 ? (
          <Empty>No requests yet.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Kind</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Note</th>
                <th>Reviewer note</th>
                <th>Raised</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{TOKEN_REQUEST_KIND_LABEL[r.kind]}</td>
                  <td className="cell-num">{r.amount.toLocaleString()}</td>
                  <td>
                    <span className={statusBadgeClass(r.status)}>{r.status}</span>
                  </td>
                  <td className="cell-muted">{r.note ?? '—'}</td>
                  <td className="cell-muted">{r.resolutionNote ?? '—'}</td>
                  <td className="cell-muted">{formatDate(r.createdAt)}</td>
                  <td>
                    {r.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => void cancel(r.id)}
                        disabled={cancellingId === r.id}
                      >
                        {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
