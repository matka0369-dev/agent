import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { SessionInfo, StatusImpact, UserSummary } from '../lib/types';
import { ConfirmStatusDialog } from './ConfirmStatusDialog';
import {
  Alert,
  Button,
  Card,
  Empty,
  RefreshButton,
  RoleBadge,
  StatusBadge,
  TableWrap,
  formatDate,
  shortUserAgent,
} from './ui';

/**
 * Managed-user list. `canManage` controls whether write actions render at
 * all — the server enforces the same rules regardless, this just avoids
 * showing buttons that would 403.
 */
export function UserTable({
  title,
  desc,
  users,
  canManage,
  onChanged,
  linkTo,
}: {
  title: string;
  desc?: string;
  users: UserSummary[];
  canManage: boolean;
  onChanged: () => void;
  /** When given, a row's username becomes a link to this path — e.g. Platform
   *  Admin clicking into one Admin's business summary. Omit for a table
   *  that's just a roster. */
  linkTo?: (user: UserSummary) => string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openSessions, setOpenSessions] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  // Status changes cascade through a subtree, so they go via a confirmation
  // that shows the real blast radius first — see ConfirmStatusDialog.
  const [pending, setPending] = useState<{ id: string; impact: StatusImpact } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function askToToggleStatus(id: string) {
    setBusyId(id);
    setError(null);
    try {
      setPending({ id, impact: await api.statusImpact(id) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmToggleStatus() {
    if (!pending) return;
    setConfirmBusy(true);
    setError(null);
    try {
      await api.setUserStatus(pending.id, pending.impact.nextIsActive);
      setPending(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function toggleSessions(id: string) {
    if (openSessions === id) {
      setOpenSessions(null);
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      setSessions(await api.userSessions(id));
      setOpenSessions(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card title={title} desc={desc} flush action={<RefreshButton onClick={onChanged} />}>
      {error && (
        <div style={{ padding: 16, paddingBottom: 0 }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {users.length === 0 ? (
        <Empty>No accounts yet.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Belongs to</th>
              <th>Status</th>
              <th>Tokens</th>
              <th>Created</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              // Fragment (not <>) so the key lives on the wrapper — a row can
              // expand into a second <tr> for its sessions.
              <Fragment key={u.id}>
                <tr>
                  <td>
                    {linkTo ? (
                      <Link to={linkTo(u)} className="cell-strong cell-link">
                        {u.username}
                      </Link>
                    ) : (
                      <div className="cell-strong">{u.username}</div>
                    )}
                    <div className="cell-muted">{u.email}</div>
                  </td>
                  <td>
                    <RoleBadge type={u.accountType} />
                  </td>
                  {/* Where this account sits in the hierarchy: a Player hangs
                      off its Agent, everyone else off whoever created it. */}
                  <td>
                    {u.agent ? (
                      <>
                        <div className="cell-strong">{u.agent.username}</div>
                        <div className="cell-muted">agent</div>
                      </>
                    ) : u.createdBy ? (
                      <>
                        <div className="cell-strong">{u.createdBy.username}</div>
                        <div className="cell-muted">created this account</div>
                      </>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge active={u.isActive} />
                  </td>
                  <td className="cell-num">{u.balance.toLocaleString()}</td>
                  <td className="cell-muted">{formatDate(u.createdAt)}</td>
                  {canManage && (
                    <td className="cell-actions">
                      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          disabled={busyId === u.id}
                          onClick={() => void toggleSessions(u.id)}
                        >
                          {openSessions === u.id ? 'Hide logins' : 'Logins'}
                        </Button>
                        <Button
                          size="sm"
                          variant={u.isActive ? 'danger' : 'ghost'}
                          disabled={busyId === u.id}
                          onClick={() => void askToToggleStatus(u.id)}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
                {openSessions === u.id && (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} style={{ background: 'var(--surface-2)' }}>
                      {sessions.length === 0 ? (
                        <div className="note">No active sessions for {u.username}.</div>
                      ) : (
                        <div>
                          <div className="btn-row" style={{ marginBottom: 10 }}>
                            <span className="note" style={{ flex: 1 }}>
                              {sessions.length} active session{sessions.length === 1 ? '' : 's'}
                            </span>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busyId === u.id}
                              onClick={() =>
                                void run(u.id, async () => {
                                  await api.forceLogout(u.id);
                                  setSessions([]);
                                })
                              }
                            >
                              Force log out everywhere
                            </Button>
                          </div>
                          {sessions.map((s) => (
                            <div key={s.id} className="note">
                              {shortUserAgent(s.userAgent)} · {s.ipAddress ?? '—'} ·{' '}
                              {formatDate(s.createdAt)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </TableWrap>
      )}

      {pending && (
        <ConfirmStatusDialog
          impact={pending.impact}
          busy={confirmBusy}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmToggleStatus()}
        />
      )}
    </Card>
  );
}
