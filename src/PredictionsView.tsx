import { ConsolidatedBets } from './ConsolidatedBets';
import { PredictionsBoard } from './PredictionsBoard';
import { getDefaultView, setDefaultView, setView, usePredictions } from './predictionsStore';

/**
 * Both predictions views behind one switch, over one shared store.
 *
 * - The view you are on is kept in the store, so moving to another dashboard
 *   tab and back leaves you where you were, with the same filters and data.
 * - "Use as my default" saves the current view as the one this browser opens
 *   to on a fresh visit. It is a per-browser setting (no server-side
 *   preference exists), so it follows the browser, not the account.
 */
export function PredictionsView() {
  const { view } = usePredictions();
  const isDefault = getDefaultView() === view;

  return (
    <>
      <div className="pv-bar">
        <div className="pv-switch" role="group" aria-label="Predictions view">
          <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
            Board
          </button>
          <button type="button" aria-pressed={view === 'classic'} onClick={() => setView('classic')}>
            Classic
          </button>
        </div>
        <label className="pv-default">
          <input
            type="checkbox"
            checked={isDefault}
            // A default always exists, so unticking has nothing to fall back to:
            // the box is only ever ticked to make the current view the default.
            disabled={isDefault}
            onChange={() => setDefaultView(view)}
          />
          <span>{isDefault ? `${view === 'board' ? 'Board' : 'Classic'} is your default` : 'Use as my default'}</span>
        </label>
      </div>
      {view === 'board' ? <PredictionsBoard /> : <ConsolidatedBets />}
    </>
  );
}
