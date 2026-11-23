import { call } from './inviteApi';
import type { BetRow } from './consolidate';
import type { TokenRequest } from './shared';

// Calls for the screens in this app that the shared client doesn't cover. A
// client of its own for the same reason as inviteApi: shared/ is vendored and
// overwritten on every monorepo sync.

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface PnlRow {
  gameId: string;
  gameName: string;
  date: string;
  betCount: number;
  wonCount: number;
  pendingCount: number;
  totalStake: number;
  totalPayout: number;
  net: number;
}

export interface DayResult {
  gameId: string;
  gameName: string;
  date: string;
  openPana: string | null;
  closePana: string | null;
  /** Ank: last digit of the pana's digit sum, derived server-side. */
  openSingle: number | null;
  closeSingle: number | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  actor: { id: string; username: string; type: string } | null;
  target: { id: string; username: string | null } | null;
  meta: Record<string, unknown> | null;
}

export const opsApi = {
  wallet: () => call<{ balance: number; winningsBalance: number }>('GET', '/ledger/wallet'),
  aggregate: (q: { gameId?: string; from?: string; to?: string }) =>
    call<{ singleAgent: boolean; rows: BetRow[] }>('GET', `/predictions/aggregate${qs(q)}`),
  /** Declared results for one day (optionally one game). */
  results: (date: string, gameId?: string) =>
    call<DayResult[]>('GET', `/games/results${qs({ date, gameId })}`),
  pnl: (q: { from?: string; to?: string }) =>
    call<{ rows: PnlRow[]; totals: Omit<PnlRow, 'gameId' | 'gameName' | 'date'> }>('GET', `/predictions/agent-pnl${qs(q)}`),
  audit: (q: { actorId?: string; action?: string; from?: string; to?: string }) =>
    call<AuditEntry[]>('GET', `/audit${qs({ ...q, limit: '300' })}`),
  lookupRequest: (code: string) => call<TokenRequest>('GET', `/token-requests/lookup${qs({ code })}`),
};
