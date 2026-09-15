import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { tokenRequestKindLabel, useLang } from '../lib/i18n';
import { type TokenRequest, type TokenRequestKind } from '../lib/types';
import { Alert, Button, Card, Empty, Field, RefreshButton, TableWrap, formatDate } from './ui';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// Every attachment is compressed client-side to this before it's ever sent —
// see compressImage below — so the 2MB the server enforces
// (core-service's MAX_IMAGE_BYTES) is a backstop this path shouldn't reach
// in practice, not the everyday ceiling.
const COMPRESS_TARGET_BYTES = 1_000_000;
const MAX_DIMENSION = 1600;
// Sanity ceiling on the *input* file, before any decoding is attempted — not
// the compressed output's size. A file past this is more likely broken or
// hostile than a phone photo, and decoding it would just hang the tab.
const MAX_INPUT_FILE_BYTES = 25 * 1024 * 1024;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode that image'))), 'image/jpeg', quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales (past MAX_DIMENSION on the longer side) and re-encodes as JPEG
 * at decreasing quality — and, if quality alone isn't enough, decreasing
 * size too — until the result fits COMPRESS_TARGET_BYTES or the loop runs
 * out of steps. A phone-camera photo or a raw PNG screenshot each easily
 * reach 5-10MB; this is what keeps either from ever going out as-is.
 *
 * Always re-encodes as JPEG regardless of the input format (PNG included),
 * which flattens any transparency to white first — reasonable for a
 * screenshot/photo attachment, which is what this field is for.
 */
async function compressImage(file: File): Promise<string> {
  const img = await loadImageElement(file);
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  let quality = 0.85;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= COMPRESS_TARGET_BYTES) break;
    if (quality > 0.5) {
      quality -= 0.15;
    } else {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
  }
  return blobToDataUrl(blob!);
}

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
 * An amount, a note, and — since 2026-09-15, by explicit sign-off — one
 * optional image, shown to whichever reviewer already has this request in
 * scope. See ARCHITECTURE.md "Hard safety boundaries" for the exact
 * revision: the image is displayed to a human, never parsed or treated as
 * proof of anything that happened outside this ledger.
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
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);
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

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file again after Remove still fire onChange
    if (!file) return;
    setImageError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(t('requests.imageInvalidType', 'Must be a PNG, JPEG, or WebP image'));
      return;
    }
    if (file.size > MAX_INPUT_FILE_BYTES) {
      setImageError(t('requests.imageTooLarge', 'That image is too large to process'));
      return;
    }
    setCompressingImage(true);
    try {
      setImage(await compressImage(file));
    } catch {
      setImageError(t('requests.imageCompressFailed', 'Could not process that image — try a different one'));
    } finally {
      setCompressingImage(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      await api.createTokenRequest({
        kind,
        amount: parsed,
        note: note.trim() || undefined,
        image: image ?? undefined,
      });
      setOkMessage(
        kind === 'TOP_UP'
          ? t('requests.askedAgent', 'Asked your Agent for {n} tokens.', { n: parsed.toLocaleString() })
          : t('requests.offeredGiveUp', 'Offered to give up {n} tokens.', { n: parsed.toLocaleString() }),
      );
      setAmount('');
      setNote('');
      setImage(null);
      setImageError(null);
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

          <Field
            label={t('requests.imageLabel', 'Attach an image (optional)')}
            hint={
              imageError ??
              (compressingImage
                ? t('requests.imageCompressing', 'Compressing image…')
                : t('requests.imageHint', 'PNG, JPEG, or WebP — resized and compressed automatically'))
            }
            hintTone={imageError ? 'bad' : undefined}
          >
            {image ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={image}
                  alt=""
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setImage(null);
                    setImageError(null);
                  }}
                >
                  {t('requests.removeImage', 'Remove')}
                </Button>
              </div>
            ) : (
              <input
                className="input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void handleImageChange(e)}
                disabled={compressingImage}
                aria-invalid={Boolean(imageError)}
              />
            )}
          </Field>

          <Button type="submit" variant="primary" disabled={!canSubmit || submitting || compressingImage}>
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
                <th>{t('requests.imageColumn', 'Image')}</th>
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
                  <td>
                    {r.imageMimeType ? (
                      <a href={api.tokenRequestImageUrl(r.id)} target="_blank" rel="noreferrer">
                        <img
                          src={api.tokenRequestImageUrl(r.id)}
                          alt={t('requests.viewImage', 'View')}
                          style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                        />
                      </a>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
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
