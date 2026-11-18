import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Field, TableWrap, formatDate, type UserSummary } from './shared';
import { opsApi, type AuditEntry } from './opsApi';

const ACTION_LABEL: Record<string, string> = {
  'user.create': 'Created an account',
  'user.enable': 'Enabled an account',
  'user.disable': 'Disabled an account',
  'user.force_logout': 'Signed a user out everywhere',
  'player.signup': 'Signed up',
  'player.new_link': 'Issued a new sign-in link',
  'tokens.transfer': 'Moved tokens',
  'tokens.grant': 'Received a token grant',
  'request.claim': 'Picked up a request',
  'request.approve': 'Approved a request',
  'request.reject': 'Rejected a request',
  'role.assign': 'Gave a role',
  'role.unassign': 'Removed a role',
  'rates.update_giving': 'Changed the giving rates',
  'contacts.update': 'Changed WhatsApp numbers',
};

const GROUPS = [
  ['', 'All actions'], ['user.', 'Accounts'], ['tokens.', 'Tokens'], ['request.', 'Token requests'],
  ['role.', 'Roles'], ['rates.', 'Rates'], ['player.', 'Players'], ['contacts.', 'Contacts'],
] as const;

const detail = (e: AuditEntry) => {
  const m = e.meta ?? {};
  const bits: string[] = [];
  if (typeof m.amount === 'number') bits.push(`${m.amount.toLocaleString()} tokens`);
  if (typeof m.delta === 'number') bits.push(`${m.delta > 0 ? '+' : ''}${m.delta.toLocaleString()} tokens`);
  if (typeof m.kind === 'string') bits.push(m.kind);
  if (typeof m.role === 'string') bits.push(m.role);
  if (typeof m.accountType === 'string') bits.push(m.accountType.toLowerCase().replace('_', ' '));
  return bits.join(' · ');
};

/** Who did what in this Agent's business, newest first — employees by name. */
export function ActivityLog({ staff }: { staff: UserSummary[] }) {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await opsApi.audit({ actorId, action, from, to }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, action, from, to]);

  return (
    <>
      <Card title="Activity log" desc="Every notable action, with the person who did it.">
        <div className="btn-row" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Who">
            <select className="input" value={actorId} onChange={(e) => setActorId(e.target.value)}>
              <option value="">Everyone</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.username}</option>)}
            </select>
          </Field>
          <Field label="What">
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
              {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Button onClick={() => void load()}>Refresh</Button>
        </div>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
      <Card flush>
        {rows.length === 0 ? (
          <Empty>Nothing logged for this filter yet.</Empty>
        ) : (
          <TableWrap>
            <thead><tr><th>When</th><th>Who</th><th>Did</th><th>About</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="cell-muted">{formatDate(e.at)}</td>
                  <td className="cell-strong">{e.actor?.username ?? '—'}</td>
                  <td>{ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="cell-muted">{e.target?.username ?? ''}</td>
                  <td className="cell-muted">{detail(e)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
