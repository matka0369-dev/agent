import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { TOKEN_REQUEST_KIND_LABEL, type TokenRequest, type TokenRequestStatus } from '../lib/types';
import { Alert, Button, Card, Empty, Field, TableWrap, formatDate } from './ui';

function statusBadgeClass(status: TokenRequest['status']) {
  if (status === 'APPROVED') return 'badge badge--ok';
  if (status === 'PENDING') return 'badge badge--muted';
  return 'badge badge--off'; // REJECTED, CANCELLED
}

const STATUS_OPTIONS: { value: TokenRequestStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: '', label: 'All' },
];

/**
 * The token-request queue: claim, reject, or approve.
 *
 * Every button is shown to every reviewer who can see this queue at all
 * (native Agent/Admin, or their staff) — the row itself doesn't try to
 * mirror the server's approval rule, which depends on both the request's
 * `kind` and who the viewer is. Attempting an approval the caller isn't
 * entitled to fails with the server's own explanatory message (e.g. "Staff
 * can claim and reject requests, but approving moves tokens — that is the
 * account holder's alone") rather than a client-side guess at the same
 * rule risking disagreeing with it.
 */
export function RequestQueueCard({ viewerId }: { viewerId?: string }) {
  const [status, setStatus] = useState<TokenRequestStatus | ''>('PENDING');
  const [requests, setRequests] = useState<TokenRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setRequests(await api.tokenRequestQueue(status || undefined));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Token requests"
      desc="Top-ups are approved by the Player's own Agent, out of that Agent's wallet. Surrenders are approved by an Admin and destroy the tokens — staff may claim and reject either, but never approve."
      action={
        <Field label="">
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as TokenRequestStatus | '')}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      }
      flush
    >
      {error && (
        <div style={{ padding: '16px 16px 0' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {loadError && (
        <div style={{ padding: '16px 16px 0' }}>
          <Alert tone="error">{loadError}</Alert>
        </div>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : requests.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Player</th>
              <th>Kind</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Note</th>
              <th>Status</th>
              <th>Claimed by</th>
              <th>Raised</th>
              <th style={{ minWidth: 260 }} />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const busy = busyId === r.id;
              const claimedByMe = r.claimedBy?.id === viewerId;
              const claimedByOther = !!r.claimedBy && !claimedByMe;
              return (
                <tr key={r.id}>
                  <td className="cell-strong">{r.requester.username}</td>
                  <td>{TOKEN_REQUEST_KIND_LABEL[r.kind]}</td>
                  <td className="cell-num">{r.amount.toLocaleString()}</td>
                  <td className="cell-muted">{r.note ?? '—'}</td>
                  <td>
                    <span className={statusBadgeClass(r.status)}>{r.status}</span>
                    {r.resolutionNote && <div className="cell-muted">{r.resolutionNote}</div>}
                  </td>
                  <td className="cell-muted">{r.claimedBy?.username ?? '—'}</td>
                  <td className="cell-muted">{formatDate(r.createdAt)}</td>
                  <td>
                    {r.status === 'PENDING' && (
                      <div style={{ display: 'grid', gap: 4 }}>
                        {/* Claiming is advisory only — it lets a queue worked by
                            several reviewers see who's on what, but deliberately
                            never blocks anyone else from resolving. Gating
                            Reject/Approve on it here would reintroduce exactly
                            the "reviewer went to lunch, queue is frozen" failure
                            the server was written to avoid. */}
                        {claimedByOther && (
                          <span className="cell-muted" style={{ fontSize: 12 }}>
                            Claimed by {r.claimedBy!.username} — you can still act on it.
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {!r.claimedBy && (
                            <Button size="sm" disabled={busy} onClick={() => void act(r.id, () => api.claimTokenRequest(r.id))}>
                              Claim
                            </Button>
                          )}
                          {claimedByMe && (
                            <Button size="sm" disabled={busy} onClick={() => void act(r.id, () => api.releaseTokenRequestClaim(r.id))}>
                              Release
                            </Button>
                          )}
                          <input
                            className="input"
                            style={{ width: 140 }}
                            placeholder="Note (optional)"
                            value={noteDrafts[r.id] ?? ''}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void act(r.id, () => api.rejectTokenRequest(r.id, noteDrafts[r.id]?.trim() || undefined))}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() => void act(r.id, () => api.approveTokenRequest(r.id, noteDrafts[r.id]?.trim() || undefined))}
                          >
                            {busy ? 'Working…' : 'Approve'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
