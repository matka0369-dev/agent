import type { Prediction, PredictionOutcome } from '../lib/types';
import { PREDICTION_TYPE_LABEL } from '../lib/types';
import { Card, CopyButton, Empty, RefreshButton, TableWrap, formatDate } from './ui';

// String order, not numeric — "10" sorts before "9" here, which is exactly
// the point: a picked number is a fixed-width code (a Jodi's "00" or a
// pana's "003"), not a quantity, so treating it as one would put "9" ahead
// of a lower three-digit pana it doesn't actually outrank.
function byPickedNumberAscending(a: Prediction, b: Prediction): number {
  return a.pickedNumber < b.pickedNumber ? -1 : a.pickedNumber > b.pickedNumber ? 1 : 0;
}

function toTsv(predictions: Prediction[], showPlayer: boolean): string {
  const header = [
    ...(showPlayer ? ['Player'] : []),
    'Game',
    'Type',
    'Pick',
    'Stake',
    'Odds',
    'Outcome',
    'Payout',
    'Placed',
  ];
  const lines = [header.join('\t')];
  for (const p of [...predictions].sort(byPickedNumberAscending)) {
    lines.push(
      [
        ...(showPlayer ? [p.user.username] : []),
        p.round.game.name,
        PREDICTION_TYPE_LABEL[p.typeId],
        p.pickedNumber,
        String(p.stake),
        `${p.oddsMultiplier}x`,
        p.outcome,
        p.payout === null ? '' : String(p.payout),
        formatDate(p.createdAt),
      ].join('\t'),
    );
  }
  return lines.join('\n');
}

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
  onRefresh,
  refreshing,
}: {
  predictions: Prediction[];
  title?: string;
  desc?: string;
  showPlayer?: boolean;
  /** Owner (SubtreePredictionsCard/MyPredictionsCard) fetches; this table is
   *  purely presentational, so a manual refresh is passed in rather than
   *  fetched here. Omit for a caller with no refetch path of its own. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const action = (
    <div className="btn-row">
      {predictions.length > 0 && <CopyButton getText={() => toTsv(predictions, showPlayer)} />}
      {onRefresh && <RefreshButton onClick={onRefresh} refreshing={refreshing} />}
    </div>
  );

  if (predictions.length === 0) {
    return (
      <Card title={title ?? 'Predictions'} desc={desc} action={onRefresh ? action : undefined}>
        <Empty>No predictions yet.</Empty>
      </Card>
    );
  }

  return (
    <Card title={title ?? 'Predictions'} desc={desc} flush action={action}>
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
