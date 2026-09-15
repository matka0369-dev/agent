import { predictionTypeLabel, useLang } from '../lib/i18n';
import { PREDICTION_TYPE_LABEL, type Prediction, type PredictionOutcome } from '../lib/types';
import { Card, CopyButton, Empty, RefreshButton, formatDate } from './ui';

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

function outcomeCardClass(outcome: PredictionOutcome): string {
  if (outcome === 'WON') return ' prediction-card--won';
  if (outcome === 'LOST') return ' prediction-card--lost';
  return '';
}

function OutcomeBadge({ outcome }: { outcome: PredictionOutcome }) {
  const { t } = useLang();
  const cls = outcome === 'WON' ? 'badge--ok' : outcome === 'LOST' ? 'badge--off' : 'badge--muted';
  const label =
    outcome === 'WON'
      ? t('predict.outcomeWon', 'Won')
      : outcome === 'LOST'
        ? t('predict.outcomeLost', 'Lost')
        : t('predict.outcomePending', 'Pending');
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
  enableCopy = true,
  onRefresh,
  refreshing,
}: {
  predictions: Prediction[];
  title?: string;
  desc?: string;
  showPlayer?: boolean;
  /** Off for the Player's own history (MyPredictionsCard) — a copy-to-
   *  clipboard export is an Admin/Agent reporting tool, not something a
   *  Player looking at their own dozen bets needs. */
  enableCopy?: boolean;
  /** Owner (SubtreePredictionsCard/MyPredictionsCard) fetches; this table is
   *  purely presentational, so a manual refresh is passed in rather than
   *  fetched here. Omit for a caller with no refetch path of its own. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { t } = useLang();
  const action = (
    <div className="btn-row">
      {enableCopy && predictions.length > 0 && <CopyButton getText={() => toTsv(predictions, showPlayer)} />}
      {onRefresh && <RefreshButton onClick={onRefresh} refreshing={refreshing} />}
    </div>
  );

  if (predictions.length === 0) {
    return (
      <Card title={title ?? t('predict.yourPredictionsTitle', 'Predictions')} desc={desc} action={onRefresh ? action : undefined}>
        <Empty>{t('predict.noPredictionsYet', 'No predictions yet.')}</Empty>
      </Card>
    );
  }

  return (
    <Card title={title ?? t('predict.yourPredictionsTitle', 'Predictions')} desc={desc} action={action}>
      <div className="prediction-card-list">
        {predictions.map((p) => (
          <div key={p.id} className={`prediction-card${outcomeCardClass(p.outcome)}`}>
            <div className="prediction-card__top">
              <div>
                <div className="prediction-card__game">{p.round.game.name}</div>
                {showPlayer && <div className="cell-muted">{p.user.username}</div>}
              </div>
              <OutcomeBadge outcome={p.outcome} />
            </div>

            <div className="prediction-card__meta">
              <div>
                <div className="prediction-card__meta-label">{t('predict.yourPick', 'Pick')}</div>
                <div className="prediction-card__meta-value prediction-card__pick">{p.pickedNumber}</div>
              </div>
              <div>
                <div className="prediction-card__meta-label">{t('predict.metaType', 'Type')}</div>
                <div className="prediction-card__meta-value">{predictionTypeLabel(t, p.typeId)}</div>
              </div>
              <div>
                <div className="prediction-card__meta-label">{t('predict.stake', 'Stake')}</div>
                <div className="prediction-card__meta-value">{p.stake.toLocaleString()}</div>
              </div>
              <div>
                <div className="prediction-card__meta-label">{t('predict.metaOdds', 'Odds')}</div>
                <div className="prediction-card__meta-value">{p.oddsMultiplier}x</div>
              </div>
              <div>
                <div className="prediction-card__meta-label">{t('predict.metaPayout', 'Payout')}</div>
                {/* Null on a loss and while pending — both genuinely have no
                    payout, and 0 would read as "paid nothing" instead. */}
                <div
                  className="prediction-card__meta-value"
                  style={{ color: p.payout ? 'var(--success)' : undefined }}
                >
                  {p.payout === null ? '—' : `+${p.payout.toLocaleString()}`}
                </div>
              </div>
              <div>
                <div className="prediction-card__meta-label">{t('predict.metaPlaced', 'Placed')}</div>
                <div className="prediction-card__meta-value cell-muted">{formatDate(p.createdAt)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
