// Pure helpers behind the consolidated bets table: grouping, the percentage
// cut, sorting, and the copy text. Kept free of React so they can be tested.

export interface BetRow {
  gameId: string;
  gameName: string;
  date: string;
  typeId: string;
  pickedNumber: string;
  betCount: number;
  totalStake: number;
}

export type SortKey = 'number-asc' | 'number-desc' | 'amount-asc' | 'amount-desc';

export const SORT_LABEL: Record<SortKey, string> = {
  'number-asc': 'Number, low to high',
  'number-desc': 'Number, high to low',
  'amount-asc': 'Amount, low to high',
  'amount-desc': 'Amount, high to low',
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The amount left after taking `pct` percent off. 0 (the default) cuts nothing. */
export function cutAmount(amount: number, pct: number): number {
  const p = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  return round2(amount * (1 - p / 100));
}

/** Plain digits compare as numbers (so 5 < 46 < 128), anything else as text. */
function byNumber(a: string, b: string): number {
  const na = /^\d+$/.test(a) ? Number(a) : NaN;
  const nb = /^\d+$/.test(b) ? Number(b) : NaN;
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortRows<T extends { pickedNumber: string; totalStake: number }>(rows: T[], key: SortKey): T[] {
  const out = [...rows];
  switch (key) {
    case 'number-asc':
      return out.sort((a, b) => byNumber(a.pickedNumber, b.pickedNumber));
    case 'number-desc':
      return out.sort((a, b) => byNumber(b.pickedNumber, a.pickedNumber));
    case 'amount-asc':
      return out.sort((a, b) => a.totalStake - b.totalStake || byNumber(a.pickedNumber, b.pickedNumber));
    case 'amount-desc':
      return out.sort((a, b) => b.totalStake - a.totalStake || byNumber(a.pickedNumber, b.pickedNumber));
  }
}

export interface Block {
  key: string;
  gameName: string;
  date: string;
  typeId: string;
  rows: BetRow[];
}

/** One block per (game, date, bet type), in first-seen order. */
export function groupBlocks(rows: BetRow[]): Block[] {
  const map = new Map<string, Block>();
  for (const r of rows) {
    const key = `${r.gameId}|${r.date}|${r.typeId}`;
    let b = map.get(key);
    if (!b) {
      b = { key, gameName: r.gameName, date: r.date, typeId: r.typeId, rows: [] };
      map.set(key, b);
    }
    b.rows.push(r);
  }
  return [...map.values()];
}

export const blockTotal = (rows: BetRow[], pct: number) => round2(rows.reduce((a, r) => a + cutAmount(r.totalStake, pct), 0));

const heading = (b: Block, label: string, pct: number) =>
  `${b.gameName} — ${b.date} — ${label}${pct > 0 ? ` (after −${pct}%)` : ''}`;

/** "number - amount" lines, one per row, then the total. */
export function blockCopyText(b: Block, label: string, pct: number, sort: SortKey): string {
  const lines = sortRows(b.rows, sort).map((r) => `${r.pickedNumber} - ${cutAmount(r.totalStake, pct)}`);
  return [heading(b, label, pct), ...lines, `Total: ${blockTotal(b.rows, pct)}`].join('\n');
}
