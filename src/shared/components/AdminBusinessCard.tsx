import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { AdminBusinessSummary } from '../lib/types';
import { Alert, Card, Empty, RefreshButton, Stat, formatDate } from './ui';

/**
 * Platform Admin's drill-down into one Admin's business, reached by
 * clicking a row in the Admins table (see UserTable's `linkTo`). A rollup
 * only — agent/player counts and play volume — never the individual
 * accounts or predictions underneath; see UsersService.businessSummary for
 * why that's exactly where the boundary sits for this tier.
 */
export function AdminBusinessCard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminBusinessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await api.adminBusinessSummary(id));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = (
    <div style={{ display: 'flex', gap: 8 }}>
      <RefreshButton onClick={() => void load()} refreshing={loading} />
      <Link to="/admins" className="btn btn--ghost btn--sm">
        ← All admins
      </Link>
    </div>
  );

  // Only the very first fetch blanks the page — a manual refresh keeps
  // showing the last good numbers underneath, rather than flashing back to
  // a bare "Loading…" and losing the "All admins" link with it.
  if (loading && !data) return <Empty>Loading…</Empty>;

  if (error || !data) {
    return (
      <Card title="Admin" action={action}>
        <Alert tone="error">{error ?? 'Admin not found.'}</Alert>
      </Card>
    );
  }

  return (
    <Card title={data.username} desc={`Admin since ${formatDate(data.createdAt)}`} action={action}>
      <div className="grid grid--stats">
        <Stat label="Agents" value={data.agents.total} hint={`${data.agents.active} active`} />
        <Stat label="Users" value={data.players.total} hint={`${data.players.active} active`} />
        <Stat
          label="Total predictions"
          value={data.predictions.totalCount.toLocaleString()}
          hint={`${data.predictions.totalStake.toLocaleString()} tokens staked, lifetime`}
        />
        <Stat
          label="Daily average play"
          value={data.predictions.dailyAverageCount.toLocaleString()}
          hint={`${data.predictions.dailyAverageStake.toLocaleString()} tokens/day`}
        />
      </div>
    </Card>
  );
}
