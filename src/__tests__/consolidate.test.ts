import { describe, expect, it } from 'vitest';
import { blockCopyText, blockTotal, cutAmount, groupBlocks, sortRows, type BetRow } from '../consolidate';

const row = (n: string, stake: number, over: Partial<BetRow> = {}): BetRow => ({
  gameId: 'g1', gameName: 'Kalyan', date: '2026-11-18', typeId: 'OPEN_SINGLE', pickedNumber: n, betCount: 1, totalStake: stake, ...over,
});

describe('cutAmount', () => {
  it('cuts nothing at the default 0%', () => expect(cutAmount(1000, 0)).toBe(1000));
  it('takes 10% off 1000 -> 900', () => expect(cutAmount(1000, 10)).toBe(900));
  it('keeps two decimals', () => expect(cutAmount(333, 7.5)).toBe(308.03));
  it('clamps nonsense percentages', () => {
    expect(cutAmount(500, -5)).toBe(500);
    expect(cutAmount(500, 150)).toBe(0);
    expect(cutAmount(500, NaN)).toBe(500);
  });
});

describe('sortRows', () => {
  const rows = [row('46', 300), row('5', 900), row('128', 100), row('0', 100)];
  it('orders numbers numerically, not as text', () => {
    expect(sortRows(rows, 'number-asc').map((r) => r.pickedNumber)).toEqual(['0', '5', '46', '128']);
    expect(sortRows(rows, 'number-desc').map((r) => r.pickedNumber)).toEqual(['128', '46', '5', '0']);
  });
  it('orders by amount, ties by number', () => {
    expect(sortRows(rows, 'amount-desc').map((r) => r.pickedNumber)).toEqual(['5', '46', '0', '128']);
    expect(sortRows(rows, 'amount-asc').map((r) => r.pickedNumber)).toEqual(['0', '128', '46', '5']);
  });
  it('does not mutate its input', () => {
    const copy = [...rows];
    sortRows(rows, 'amount-desc');
    expect(rows).toEqual(copy);
  });
});

describe('groupBlocks / copy text', () => {
  const rows = [row('1', 400), row('5', 200), row('7', 50, { typeId: 'JODI' }), row('1', 10, { date: '2026-11-17' })];
  it('makes one block per game, day and bet type', () => {
    const blocks = groupBlocks(rows);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].rows.map((r) => r.pickedNumber)).toEqual(['1', '5']);
  });
  it('totals and copies the amounts after the cut', () => {
    const [b] = groupBlocks(rows);
    expect(blockTotal(b.rows, 10)).toBe(540);
    expect(blockCopyText(b, 'Single (Open)', 10, 'number-asc')).toBe(
      'Kalyan — 2026-11-18 — Single (Open) (after −10%)\n1 - 360\n5 - 180\nTotal: 540',
    );
  });
  it('copies the plain amounts at 0%', () => {
    const [b] = groupBlocks(rows);
    expect(blockCopyText(b, 'Single (Open)', 0, 'amount-desc')).toBe('Kalyan — 2026-11-18 — Single (Open)\n1 - 400\n5 - 200\nTotal: 600');
  });
});
