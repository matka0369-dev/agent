import type { Prediction, PredictionOutcome } from '../lib/types';
import { PREDICTION_TYPE_LABEL } from '../lib/types';
import { Card, Empty, TableWrap, formatDate } from './ui';

function OutcomeBadge({ outcome }: { outcome: PredictionOutcome }) {
  const cls = outcome === 'WON' ? 'badge--ok' : outcome === 'LOST' ? 'badge--off' : 'badge--muted';
  const label = outcome === 'WON' ? 'Won' : outcome === 'LOST' ? 'Lost' : 'Pending';
  return <span className={`badge ${cls}`}>{label}</span>;
}

// Shared by the Agent and Admin dashboards — same shape either way, just a
// wider slice of the hierarchy behind it (see PredictionsService in
// core-service). Player's own history uses the same table too.
export function PredictionsTable({
  predictions,
  title,
  desc,
  showPlayer = true,
}: {
  predictions: Prediction[];
  title?: string;
  desc?: string;
  showPlayer?: boolean;
}) {
  if (predictions.length === 0) {
    return (
      <Card title={title ?? 'Predictions'} desc={desc}>
        <Empty>No predictions yet.</Empty>
      </Card>
    );
  }

  return (
    <Card title={title ?? 'Predictions'} desc={desc} flush>
      <TableWrap>
        <thead>
          <tr>
            {showPlayer && <th>Player</th>}
            <th>Game</th>
            <th>Type</th>
            <th>Pick</th>
            <th style={{ textAlign: 'right' }}>Stake</th>
            <th style={{ textAlign: 'right' }}>Odds</th>
            <th>Outcome</th>
            <th style={{ textAlign: 'right' }}>Payout</th>
            <th>Placed</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((p) => (
            <tr key={p.id}>
              {showPlayer && <td className="cell-strong">{p.user.username}</td>}
              <td>{p.round.game.name}</td>
              <td>{PREDICTION_TYPE_LABEL[p.typeId]}</td>
              <td className="cell-num">{p.pickedNumber}</td>
              <td className="cell-num" style={{ textAlign: 'right' }}>
                {p.stake.toLocaleString()}
              </td>
              <td className="cell-num" style={{ textAlign: 'right' }}>
                {p.oddsMultiplier}x
              </td>
              <td>
                <OutcomeBadge outcome={p.outcome} />
              </td>
              <td
                className="cell-num"
                style={{ textAlign: 'right', color: p.payout ? 'var(--success)' : undefined }}
              >
                {/* Null on a loss and while pending — both genuinely have no
                    payout, and 0 would read as "paid nothing" instead. */}
                {p.payout === null ? '—' : `+${p.payout.toLocaleString()}`}
              </td>
              <td className="cell-muted">{formatDate(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Card>
  );
}
