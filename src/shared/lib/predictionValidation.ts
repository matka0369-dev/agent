// Client-side mirror of prediction-service's internal/prediction/types.go
// validators — the UI layer of the triple-layer cutoff/format check
// (UI, Go, and a DB trigger/CHECK constraint all implement this
// independently; see ARCHITECTURE.md). This file must not import from the
// Go service or vice versa — that's the point.
import type { PredictionType } from './types';

function panaDigitValue(c: string): number {
  return c === '0' ? 10 : Number(c);
}

function isDigit(c: string): boolean {
  return c.length === 1 && c >= '0' && c <= '9';
}

// 3 digits, non-decreasing under panaDigitValue ('0' sorts as 10).
function isValidPana(s: string): boolean {
  if (!/^[0-9]{3}$/.test(s)) return false;
  const [a, b, c] = [...s].map(panaDigitValue);
  return a <= b && b <= c;
}

function isSinglePana(s: string): boolean {
  return isValidPana(s) && s[0] !== s[1] && s[1] !== s[2] && s[0] !== s[2];
}

function isDoublePana(s: string): boolean {
  if (!isValidPana(s)) return false;
  const allDistinct = s[0] !== s[1] && s[1] !== s[2] && s[0] !== s[2];
  const allSame = s[0] === s[1] && s[1] === s[2];
  return !allDistinct && !allSame;
}

function isTriplePana(s: string): boolean {
  return isValidPana(s) && s[0] === s[1] && s[1] === s[2];
}

/** Returns null when valid, else a message explaining the expected format. */
export function validatePickedNumber(type: PredictionType, picked: string): string | null {
  switch (type) {
    case 'OPEN_SINGLE':
    case 'CLOSE_SINGLE':
      return isDigit(picked) ? null : 'Must be a single digit 0-9';

    case 'JODI':
      return picked.length === 2 && isDigit(picked[0]) && isDigit(picked[1])
        ? null
        : 'Must be two digits, 00-99';

    case 'OPEN_SINGLE_PANA':
    case 'CLOSE_SINGLE_PANA':
      return isSinglePana(picked)
        ? null
        : 'Must be a non-decreasing 3-digit pana with all distinct digits (0 sorts as 10)';

    case 'OPEN_DOUBLE_PANA':
    case 'CLOSE_DOUBLE_PANA':
      return isDoublePana(picked)
        ? null
        : 'Must be a non-decreasing 3-digit pana with exactly two equal digits';

    case 'OPEN_TRIPLE_PANA':
    case 'CLOSE_TRIPLE_PANA':
      return isTriplePana(picked) ? null : 'Must be a 3-digit pana with all three digits equal';

    case 'HALF_SANGAM': {
      const idx = picked.indexOf('-');
      if (idx >= 0) {
        const left = picked.slice(0, idx);
        const right = picked.slice(idx + 1);
        if (left.length === 1 && isDigit(left) && isValidPana(right)) return null;
        if (isValidPana(left) && right.length === 1 && isDigit(right)) return null;
      }
      return 'Must be "D-PPP" or "PPP-D" (a digit and a valid pana)';
    }

    case 'FULL_SANGAM': {
      const idx = picked.indexOf('-');
      if (idx >= 0) {
        const left = picked.slice(0, idx);
        const right = picked.slice(idx + 1);
        if (isValidPana(left) && isValidPana(right)) return null;
      }
      return 'Must be "PPP-PPP" (a valid open pana - a valid close pana)';
    }

    default:
      return 'Unknown prediction type';
  }
}

export const PICKED_NUMBER_PLACEHOLDER: Record<PredictionType, string> = {
  OPEN_SINGLE: '7',
  CLOSE_SINGLE: '3',
  JODI: '00',
  OPEN_SINGLE_PANA: '123',
  CLOSE_SINGLE_PANA: '456',
  OPEN_DOUBLE_PANA: '112',
  CLOSE_DOUBLE_PANA: '224',
  OPEN_TRIPLE_PANA: '111',
  CLOSE_TRIPLE_PANA: '777',
  HALF_SANGAM: '0-123',
  FULL_SANGAM: '123-456',
};
