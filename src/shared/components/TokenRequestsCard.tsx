import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { tokenRequestKindLabel, useLang } from '../lib/i18n';
import { type TokenRequest, type TokenRequestKind } from '../lib/types';
import { Alert, Button, Card, Empty, Field, RefreshButton, TableWrap, formatDate } from './ui';

function statusBadgeClass(status: TokenRequest['status']) {
  if (status === 'APPROVED') return 'badge badge--ok';
  if (status === 'PENDING') return 'badge badge--muted';
  return 'badge badge--off'; // REJECTED, CANCELLED
}

function statusLabel(t: ReturnType<typeof useLang>['t'], status: TokenRequest['status']): string {
  if (status === 'APPROVED') return t('requests.statusApproved', 'Approved');
  if (status === 'PENDING') return t('requests.statusPending', 'Pending');
  if (status === 'REJECTED') return t('requests.statusRejected', 'Rejected');
  return t('requests.statusCancelled', 'Cancelled');
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
  const { t } = useLang();
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
          ? t('requests.askedAgent', 'Asked your Agent for {n} tokens.', { n: parsed.toLocaleString() })
          : t('requests.offeredGiveUp', 'Offered to give up {n} tokens.', { n: parsed.toLocaleString() }),
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
      <Card title={t('requests.title', 'Ask for a balance change')} desc={t('requests.desc', 'Goes to your Agent (top-up) or an Admin (surrender) to review — nothing moves until they approve it.')}>
        <form onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}
          {okMessage && <Alert tone="success">{okMessage}</Alert>}
          {hasOpenOfKind && (
            <Alert tone="info">
              {t('requests.pendingWarning', 'You already have a pending {kind} request — cancel it below before raising another of the same kind.', {
                kind: tokenRequestKindLabel(t, kind).toLowerCase(),
              })}
            </Alert>
          )}

          <div className="form-row">
            <Field label={t('requests.whatDoYouNeed', 'What do you need')}>
              <select
                className="select"
                value={kind}
                onChange={(e) => setKind(e.target.value as TokenRequestKind)}
              >
                <option value="TOP_UP">{t('requests.topUpOption', 'More tokens (top-up)')}</option>
                <option value="SURRENDER">{t('requests.surrenderOption', 'Give tokens back (surrender)')}</option>
              </select>
            </Field>
            <Field
              label={t('predict.stake', 'Amount')}
              hint={
                overHeld
                  ? t('requests.onlyHold', 'You only hold {held}.', { held: held.toLocaleString() })
                  : kind === 'SURRENDER'
                    ? t('requests.holdBoth', 'You hold {held} across both wallets.', { held: held.toLocaleString() })
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

          <Field label={t('requests.noteLabel', 'Note (optional)')}>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                kind === 'TOP_UP'
                  ? t('requests.notePlaceholderTopUp', 'Running low')
                  : t('requests.notePlaceholderSurrender', "Don't need these anymore")
              }
            />
          </Field>

          <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
            {submitting ? t('requests.sending', 'Sending…') : t('requests.sendRequest', 'Send request')}
          </Button>
        </form>
      </Card>

      <Card
        title={t('requests.yourRequestsTitle', 'Your requests')}
        flush
        action={<RefreshButton onClick={() => void load()} refreshing={loading} />}
      >
        {loadError && (
          <div style={{ padding: '16px 16px 0' }}>
            <Alert tone="error">{loadError}</Alert>
          </div>
        )}
        {loading ? (
          <Empty>{t('common.loading', 'Loading…')}</Empty>
        ) : requests.length === 0 ? (
          <Empty>{t('requests.noRequestsYet', 'No requests yet.')}</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>{t('requests.kindColumn', 'Kind')}</th>
                <th style={{ textAlign: 'right' }}>{t('predict.stake', 'Amount')}</th>
                <th>{t('requests.statusColumn', 'Status')}</th>
                <th>{t('requests.noteColumn', 'Note')}</th>
                <th>{t('requests.reviewerNoteColumn', 'Reviewer note')}</th>
                <th>{t('requests.raisedColumn', 'Raised')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{tokenRequestKindLabel(t, r.kind)}</td>
                  <td className="cell-num">{r.amount.toLocaleString()}</td>
                  <td>
                    <span className={statusBadgeClass(r.status)}>{statusLabel(t, r.status)}</span>
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
                        {cancellingId === r.id ? t('requests.cancelling', 'Cancelling…') : t('requests.cancel', 'Cancel')}
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
