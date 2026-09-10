import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SessionInfo } from '../lib/types';
import { Alert, Button, Card, Empty, TableWrap, formatDate, shortUserAgent } from './ui';

/** Self-service session management — every role gets this. */
export function MySessionsCard() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await api.mySessions());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const others = sessions.filter((s) => !s.isCurrent).length;

  return (
    <Card
      title="Your sessions"
      desc="Devices currently signed in to this account."
      action={
        <Button
          size="sm"
          variant="danger"
          disabled={busy || others === 0}
          onClick={() => run(api.revokeMyOtherSessions)}
        >
          Log out {others} other{others === 1 ? '' : 's'}
        </Button>
      }
      flush
    >
      {error && (
        <div style={{ padding: 16, paddingBottom: 0 }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {sessions.length === 0 ? (
        <Empty>No active sessions.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Device</th>
              <th>IP</th>
              <th>Signed in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="cell-strong">{shortUserAgent(s.userAgent)}</span>{' '}
                  {s.isCurrent && <span className="badge">This device</span>}
                </td>
                <td className="cell-mono">{s.ipAddress ?? '—'}</td>
                <td className="cell-muted">{formatDate(s.createdAt)}</td>
                <td className="cell-actions">
                  {!s.isCurrent && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => run(() => api.revokeMySession(s.id))}
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
