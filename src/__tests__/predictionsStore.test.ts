import { beforeEach, describe, expect, it, vi } from 'vitest';

const aggregate = vi.fn();
const results = vi.fn();
vi.mock('../opsApi', () => ({ opsApi: { aggregate: (...a: unknown[]) => aggregate(...a), results: (...a: unknown[]) => results(...a) } }));

import {
  dayString, ensureAll, ensureData, getDefaultView, refresh, resetForTests, setDefaultView, setFilters,
} from '../predictionsStore';

const rowsFor = (n: number) => ({ singleAgent: false, rows: Array.from({ length: n }, (_, i) => ({
  gameId: 'g1', gameName: 'Game', date: dayString(0), typeId: 'OPEN_SINGLE', pickedNumber: String(i), betCount: 1, totalStake: 10,
})) });

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  aggregate.mockReset().mockResolvedValue(rowsFor(2));
  results.mockReset().mockResolvedValue([]);
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  });
  resetForTests();
});

describe('predictions store', () => {
  it('fetches once, then serves view and tab changes from the cache', async () => {
    ensureAll();
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(results).toHaveBeenCalledTimes(1);

    // a view switch or a tab change just re-mounts and calls ensureAll again
    ensureAll(); ensureAll();
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(results).toHaveBeenCalledTimes(1);
  });

  it('does not repeat a request that is already in flight', async () => {
    void ensureData(); void ensureData();
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('refreshes on demand', async () => {
    ensureAll();
    await flush();
    refresh();
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(results).toHaveBeenCalledTimes(2);
  });

  it('never refetches for the percentage or the sort order, only for the data filters', async () => {
    ensureAll();
    await flush();
    setFilters({ percent: '10' });
    setFilters({ sort: 'amount-desc' });
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(1);

    setFilters({ gameId: 'g1' });
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(2);

    setFilters({ gameId: '' }); // back to an already loaded selection
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('never leaves the date blank, and one day means one request', async () => {
    ensureAll();
    await flush();
    setFilters({ date: '' });
    setFilters({ date: '   ' });
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(1); // blank snapped back to today: already cached
    expect(aggregate.mock.calls[0][0]).toEqual({ gameId: undefined, from: dayString(0), to: dayString(0) });

    setFilters({ date: dayString(-1) });
    await flush();
    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(aggregate.mock.calls[1][0]).toEqual({ gameId: undefined, from: dayString(-1), to: dayString(-1) });
  });

  it('asks for the declared results of the selected day', async () => {
    ensureAll();
    await flush();
    expect(results).toHaveBeenCalledWith(dayString(0), undefined);
    setFilters({ date: dayString(-2) });
    await flush();
    expect(results).toHaveBeenLastCalledWith(dayString(-2), undefined);
  });
});

describe('default view', () => {
  it('starts on the board and remembers a saved default', () => {
    expect(getDefaultView()).toBe('board');
    setDefaultView('classic');
    expect(getDefaultView()).toBe('classic');
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(getDefaultView()).toBe('board');
    expect(() => setDefaultView('classic')).not.toThrow();
  });
});
