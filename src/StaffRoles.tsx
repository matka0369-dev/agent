import { useState } from 'react';
import { Alert, Button, Card, Empty, TableWrap, api, type Role, type UserSummary } from './shared';

/**
 * Your employees and the roles they hold. Each role is a duty — creating
 * players, moving tokens and approving requests, reading the numbers — so give
 * the money duties to someone you trust and keep them apart from the rest.
 */
export function StaffRoles({
  staff, roles, onChanged,
}: { staff: UserSummary[]; roles: Role[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setError(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <Card title="Roles" desc="What each employee is allowed to do." flush>
        {staff.length === 0 ? (
          <Empty>No staff yet. Create a staff account first.</Empty>
        ) : (
          <TableWrap>
            <thead><tr><th>Employee</th><th>Roles</th><th>Give a role</th></tr></thead>
            <tbody>
              {staff.map((s) => {
                const held = (s.roles ?? []).map((r) => r.role);
                const heldIds = new Set(held.map((r) => r.id));
                const options = roles.filter((r) => !heldIds.has(r.id));
                return (
                  <tr key={s.id}>
                    <td className="cell-strong">{s.username}{!s.isActive ? ' (disabled)' : ''}</td>
                    <td>
                      {held.length === 0 && <span className="cell-muted">none — can only look around</span>}
                      {held.map((r) => (
                        <span key={r.id} className="badge" style={{ marginRight: 6 }}>
                          {r.name}{' '}
                          <button
                            type="button"
                            aria-label={`Remove ${r.name}`}
                            disabled={busy}
                            style={{ background: 'none', border: 0, cursor: 'pointer' }}
                            onClick={() => void run(() => api.unassignRole(s.id, r.id))}
                          >×</button>
                        </span>
                      ))}
                    </td>
                    <td>
                      <div className="btn-row">
                        <select className="input" value={pick[s.id] ?? ''} onChange={(e) => setPick({ ...pick, [s.id]: e.target.value })}>
                          <option value="">Choose…</option>
                          {options.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <Button
                          size="sm"
                          disabled={busy || !pick[s.id]}
                          onClick={() => void run(async () => { await api.assignRole(s.id, pick[s.id]); setPick({ ...pick, [s.id]: '' }); })}
                        >Add</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
