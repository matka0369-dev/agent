import { useSyncExternalStore } from 'react';
import { opsApi, type DayResult, type PnlRow } from './opsApi';
import type { BetRow, SortKey } from './consolidate';

/**
 * One place for everything the Predictions page needs, outside the React tree.
 *
 * The page has two views (Board and Classic) and sits on a dashboard whose
 * tabs unmount their contents. With the state in the components, every view
 * switch or tab change threw the data away and fetched it again, and each view
 * kept its own copy of the filters. Here the filters, the fetched rows and the
 * chosen view live for as long as the page is open, so both views read the
 * same data and switching costs no request. A fetch happens only when the data
 * for the current filters is missing, older than FRESH_MS, or the user presses
 * Refresh.
 */

const FRESH_MS = 5 * 60_000;
const TZ = 'Asia/Kolkata';

export const dayString = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export interface Filters {
  gameId: string;
  /** One day at a time. (A date range belongs on a single player's page.) */
  date: string;
  percent: string;
  sort: SortKey;
}

export type View = 'board' | 'classic';

export interface Snapshot {
  filters: Filters;
  rows: BetRow[];
  loading: boolean;
  error: string | null;
  /** When the rows on screen were fetched; null until the first load. */
  fetchedAt: number | null;
  results: DayResult[];
  resultsError: string | null;
  /** What came in, what the Agent paid out to winners, and the difference, for the selected game and day. */
  pnl: Pnl | null;
  pnlError: string | null;
  games: { id: string; name: string }[];
  view: View;
}

export type Pnl = { rows: PnlRow[]; totals: Omit<PnlRow, 'gameId' | 'gameName' | 'date'> };

// --- the per-browser default view -----------------------------------------

const DEFAULT_KEY = 'predictsim.agent.predictionsDefaultView';

export function getDefaultView(): View {
  try {
    return localStorage.getItem(DEFAULT_KEY) === 'classic' ? 'classic' : 'board';
  } catch {
    return 'board'; // storage can be blocked; the page works without it
  }
}

export function setDefaultView(view: View) {
  try {
    localStorage.setItem(DEFAULT_KEY, view);
  } catch {
    /* ignore */
  }
  emit();
}

// --- state ------------------------------------------------------------------

interface DataEntry {
  rows: BetRow[];
  at: number;
}
interface ResultEntry {
  results: DayResult[];
  at: number;
}

let filters: Filters = { gameId: '', date: dayString(0), percent: '', sort: 'number-asc' };
let view: View = getDefaultView();
let rows: BetRow[] = [];
let loading = true;
let error: string | null = null;
let fetchedAt: number | null = null;
let results: DayResult[] = [];
let resultsError: string | null = null;
let pnl: Pnl | null = null;
let pnlError: string | null = null;
let games: { id: string; name: string }[] = [];

const dataCache = new Map<string, DataEntry>();
const resultCache = new Map<string, ResultEntry>();
const pnlCache = new Map<string, { data: Pnl; at: number }>();
let pnlSeq = 0;
let pnlInflight: { key: string; p: Promise<void> } | null = null;
let dataSeq = 0;
let resultSeq = 0;
// A request already on its way for the same filters is reused, not repeated
// (two components mounting together, or React's dev-mode double effect).
let dataInflight: { key: string; p: Promise<void> } | null = null;
let resultInflight: { key: string; p: Promise<void> } | null = null;

const dataKey = (f: Filters) => JSON.stringify([f.gameId, f.date]);
const resultKey = (f: Filters) => JSON.stringify([f.gameId, f.date]);
const pnlKey = resultKey;

/** The game dropdown is built from what the date range contains (an Agent has
 *  no game-list endpoint). Only an unfiltered load can tell what is there. */
function learnGames(f: Filters, fromRows: BetRow[]) {
  if (f.gameId) return;
  const seen = new Map<string, string>();
  for (const r of fromRows) seen.set(r.gameId, r.gameName);
  games = [...seen].map(([id, name]) => ({ id, name }));
}

// --- external-store plumbing --------------------------------------------------

const listeners = new Set<() => void>();
let snapshot: Snapshot = build();

function build(): Snapshot {
  return { filters, rows, loading, error, fetchedAt, results, resultsError, pnl, pnlError, games, view };
}
function emit() {
  snapshot = build();
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => snapshot;

// --- loading ------------------------------------------------------------------

/** Brings the screen up to date with the current filters. Reads the cache first;
 *  `force` (Refresh) skips it. Safe to call on every mount. */
export async function ensureData(force = false): Promise<void> {
  const key = dataKey(filters);
  const hit = dataCache.get(key);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) {
    rows = hit.rows;
    learnGames(filters, hit.rows);
    fetchedAt = hit.at;
    error = null;
    loading = false;
    emit();
    return;
  }

  if (!force && dataInflight?.key === key) return dataInflight.p;

  const id = ++dataSeq;
  loading = true;
  emit();
  const p = fetchData(id, key, filters);
  dataInflight = { key, p };
  void p.finally(() => {
    if (dataInflight?.p === p) dataInflight = null;
  });
  return p;
}

async function fetchData(id: number, key: string, f: Filters): Promise<void> {
  try {
    const res = await opsApi.aggregate({ gameId: f.gameId || undefined, from: f.date, to: f.date });
    // A slower earlier request must not overwrite a newer one.
    if (id !== dataSeq) return;
    const at = Date.now();
    dataCache.set(key, { rows: res.rows, at });
    rows = res.rows;
    learnGames(f, res.rows);
    fetchedAt = at;
    error = null;
  } catch (e) {
    if (id !== dataSeq) return;
    error = (e as Error).message;
  } finally {
    if (id === dataSeq) {
      loading = false;
      emit();
    }
  }
}

/** Declared results for the selected day (and game). */
export async function ensureResults(force = false): Promise<void> {
  const key = resultKey(filters);
  const hit = resultCache.get(key);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) {
    results = hit.results;
    resultsError = null;
    emit();
    return;
  }
  if (!force && resultInflight?.key === key) return resultInflight.p;

  const id = ++resultSeq;
  const p = fetchResultsFor(id, key, filters);
  resultInflight = { key, p };
  void p.finally(() => {
    if (resultInflight?.p === p) resultInflight = null;
  });
  return p;
}

async function fetchResultsFor(id: number, key: string, f: Filters): Promise<void> {
  try {
    const r = await opsApi.results(f.date, f.gameId || undefined);
    if (id !== resultSeq) return;
    resultCache.set(key, { results: r, at: Date.now() });
    results = r;
    resultsError = null;
  } catch (e) {
    if (id !== resultSeq) return;
    results = [];
    resultsError = (e as Error).message;
  }
  emit();
}

/** The Agent's profit and loss for the selected game and day. */
export async function ensurePnl(force = false): Promise<void> {
  const key = pnlKey(filters);
  const hit = pnlCache.get(key);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) {
    pnl = hit.data;
    pnlError = null;
    emit();
    return;
  }
  if (!force && pnlInflight?.key === key) return pnlInflight.p;

  const id = ++pnlSeq;
  const f = filters;
  const p = (async () => {
    try {
      const d = await opsApi.pnl({ from: f.date, to: f.date, gameId: f.gameId || undefined });
      if (id !== pnlSeq) return;
      pnlCache.set(key, { data: d, at: Date.now() });
      pnl = d;
      pnlError = null;
    } catch (e) {
      if (id !== pnlSeq) return;
      pnl = null;
      pnlError = (e as Error).message;
    }
    emit();
  })();
  pnlInflight = { key, p };
  void p.finally(() => {
    if (pnlInflight?.p === p) pnlInflight = null;
  });
  return p;
}

/** Everything the page needs, from cache where it can. */
export function ensureAll() {
  void ensureData();
  void ensureResults();
  void ensurePnl();
}

// --- actions --------------------------------------------------------------------

export function setFilters(patch: Partial<Filters>) {
  const before = filters;
  // A date is never blank: a cleared field goes back to today instead of
  // widening the query.
  const next = { ...patch };
  if (next.date !== undefined && next.date.trim() === '') next.date = dayString(0);
  filters = { ...filters, ...next };
  emit();
  // Percentage and sort order are display lenses only, so they never refetch.
  if (dataKey(before) !== dataKey(filters)) void ensureData();
  if (resultKey(before) !== resultKey(filters)) {
    void ensureResults();
    void ensurePnl();
  }
}

export function refresh() {
  void ensureData(true);
  void ensureResults(true);
  void ensurePnl(true);
}

export function setView(v: View) {
  view = v;
  emit();
}

/** Test seam: forget everything so a test starts from a clean store. */
export function resetForTests() {
  filters = { gameId: '', date: dayString(0), percent: '', sort: 'number-asc' };
  view = getDefaultView();
  rows = [];
  loading = true;
  error = null;
  fetchedAt = null;
  results = [];
  resultsError = null;
  pnl = null;
  pnlError = null;
  games = [];
  dataCache.clear();
  pnlCache.clear();
  pnlInflight = null;
  resultCache.clear();
  dataInflight = null;
  resultInflight = null;
  emit();
}

export function usePredictions(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
