import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { AdminBusinessSummary } from '../lib/types';
import { Alert, Card, Empty, Stat, formatDate } from './ui';

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api
      .adminBusinessSummary(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backLink = (
    <Link to="/admins" className="btn btn--ghost btn--sm">
      ← All admins
    </Link>
  );

  if (loading) return <Empty>Loading…</Empty>;

  if (error || !data) {
    return (
      <Card title="Admin" action={backLink}>
        <Alert tone="error">{error ?? 'Admin not found.'}</Alert>
      </Card>
    );
  }

  return (
    <Card title={data.username} desc={`Admin since ${formatDate(data.createdAt)}`} action={backLink}>
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
