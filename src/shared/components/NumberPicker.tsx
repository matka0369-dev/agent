import { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n';
import { generatePanas } from '../lib/predictionValidation';

// Matches the digit-order convention pana validation already uses (see
// predictionValidation.ts's panaDigitValue: '0' sorts after '9', not
// before it) — kept the same here purely for a consistent reading order
// across every grid on this page, not because Single has a decreasing-digit
// rule of its own.
const SINGLE_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// Computed once at module load, not per render — generatePanas brute-forces
// all 1000 3-digit strings, but that's still well under a millisecond and
// the three results (120/90/10 entries) never change.
const SINGLE_PANAS = generatePanas('single');
const DOUBLE_PANAS = generatePanas('double');
const TRIPLE_PANAS = generatePanas('triple');

function jodiBlock(start: number): string[] {
  return Array.from({ length: 50 }, (_, i) => String(start + i).padStart(2, '0'));
}
// "10 numbers per column" — each block is 5 tens-columns (0X.. 4X, or
// 5X..9X) of 10 units each; the grid CSS (.number-grid--jodi) lays these
// out column-major so a column really is one tens-group top to bottom.
const JODI_BLOCKS: { label: string; numbers: string[] }[] = [
  { label: '00–49', numbers: jodiBlock(0) },
  { label: '50–99', numbers: jodiBlock(50) },
];

type Family = 'single' | 'jodi' | 'pana';

/** One collapsible pana chart — native <details>, so it's keyboard/screen-
 *  reader accessible for free and never fights a Player's own open/close
 *  clicks with a React-driven `open` prop. `defaultOpen` only sets the
 *  *initial* state (an uncontrolled attribute); it's the largest single
 *  chart (120 entries) so leaving the other two collapsed keeps the page
 *  from opening 220+ buttons tall by default. */
function PanaGroup({
  label,
  numbers,
  value,
  onSelect,
  defaultOpen,
}: {
  label: string;
  numbers: string[];
  value: string;
  onSelect: (v: string) => void;
  defaultOpen?: boolean;
}) {
  return (
    <details className="pana-group" open={defaultOpen}>
      <summary className="pana-group__summary">
        {label} <span className="pana-group__count">({numbers.length})</span>
      </summary>
      <div className="number-grid number-grid--pana">
        {numbers.map((p) => (
          <NumberChip key={p} value={p} selected={value === p} onSelect={onSelect} />
        ))}
      </div>
    </details>
  );
}

function NumberChip({
  value,
  selected,
  onSelect,
}: {
  value: string;
  selected: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <button
      type="button"
      className={`number-chip${selected ? ' number-chip--selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(value)}
    >
      {value}
    </button>
  );
}

/**
 * A tap-to-pick alternative to typing the number field by hand — Single (0-9),
 * Jodi (00-99, split into two 50-number blocks), and the three Pana charts
 * (every valid non-decreasing 3-digit combination, grouped by kind). Every
 * button just calls `onSelect(value)`, which the caller wires to the same
 * setter a typed value would update — this component has no opinion on
 * validation, cutoffs, or submission, only on offering numbers to tap.
 *
 * Full Sangam isn't offered here — its "pana-pana" shape doesn't fit a flat
 * number grid, and it already has its own two pana inputs in PredictForm.
 */
export function NumberPicker({
  showJodi,
  value,
  onSelect,
}: {
  /** Jodi only exists before the open declaration — see PredictionType's
   *  cutoff-group doc. Hidden rather than disabled once that's passed. */
  showJodi: boolean;
  value: string;
  onSelect: (v: string) => void;
}) {
  const { t } = useLang();
  const [family, setFamily] = useState<Family>('single');

  useEffect(() => {
    if (!showJodi && family === 'jodi') setFamily('single');
  }, [showJodi, family]);

  return (
    <div className="number-picker">
      <div className="type-chip-row">
        <button
          type="button"
          className={`type-chip${family === 'single' ? ' type-chip--selected' : ''}`}
          onClick={() => setFamily('single')}
        >
          {t('predict.familySingle', 'Single')}
        </button>
        {showJodi && (
          <button
            type="button"
            className={`type-chip${family === 'jodi' ? ' type-chip--selected' : ''}`}
            onClick={() => setFamily('jodi')}
          >
            {t('predict.familyJodi', 'Jodi')}
          </button>
        )}
        <button
          type="button"
          className={`type-chip${family === 'pana' ? ' type-chip--selected' : ''}`}
          onClick={() => setFamily('pana')}
        >
          {t('predict.familyPana', 'Pana')}
        </button>
      </div>

      {family === 'single' && (
        <div className="number-grid">
          {SINGLE_DIGITS.map((d) => (
            <NumberChip key={d} value={d} selected={value === d} onSelect={onSelect} />
          ))}
        </div>
      )}

      {family === 'jodi' && showJodi && (
        <>
          {JODI_BLOCKS.map((block) => (
            <div key={block.label}>
              <div className="number-picker__block-label">{block.label}</div>
              <div className="number-grid number-grid--jodi">
                {block.numbers.map((n) => (
                  <NumberChip key={n} value={n} selected={value === n} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {family === 'pana' && (
        <>
          <PanaGroup
            label={t('predict.singlePana', 'Single Pana')}
            numbers={SINGLE_PANAS}
            value={value}
            onSelect={onSelect}
            defaultOpen
          />
          <PanaGroup
            label={t('predict.doublePana', 'Double Pana')}
            numbers={DOUBLE_PANAS}
            value={value}
            onSelect={onSelect}
          />
          <PanaGroup
            label={t('predict.triplePana', 'Triple Pana')}
            numbers={TRIPLE_PANAS}
            value={value}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}
