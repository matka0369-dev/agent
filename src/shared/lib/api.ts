import type {
  ActiveGame,
  AgentRateCards,
  AggregateResponse,
  AgentSummaryRow,
  AuthUser,
  BetType,
  CorrectionSummary,
  Game,
  GameForAdmin,
  GameHoliday,
  GameStatus,
  LedgerEntry,
  MyRates,
  Permission,
  Prediction,
  PredictionType,
  PredictionVolume,
  RateEntry,
  RateMeta,
  ResultCorrectionEntry,
  Role,
  SessionInfo,
  SettlementSummary,
  SettlementsResponse,
  StatusImpact,
  TokenRequest,
  TokenRequestKind,
  TokenRequestStatus,
  UserRoleEntry,
  UserSummary,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
// prediction-service (Go) — a separate process from core-service, serving
// only game listing for a Player and prediction placement. Same session
// cookie, different origin/port.
const PREDICTION_BASE_URL = import.meta.env.VITE_PREDICTION_API_BASE_URL ?? 'http://localhost:8080';

/**
 * Which portal this build is, declared in each app's vite config and sent on
 * every request. The server namespaces the session cookie by it, so the four
 * portals no longer evict each other's sessions — cookies are scoped by host
 * and ignore the port, so one name meant one shared slot across all of them.
 * Absent in a build that doesn't set it, which falls back to the old shared
 * cookie rather than breaking.
 */
const PORTAL_ID: string | undefined = import.meta.env.VITE_PORTAL;

function withPortal(headers?: HeadersInit): HeadersInit | undefined {
  if (!PORTAL_ID) return headers;
  return { ...(headers as Record<string, string> | undefined), 'X-Portal': PORTAL_ID };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      // Auth is a session cookie, so every request must carry credentials.
      credentials: 'include',
      headers: withPortal(init?.body ? { 'Content-Type': 'application/json' } : undefined),
      ...init,
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${BASE_URL}. Is core-service running?`, 0);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    // Nest error bodies put the useful part in `message`, which is either a
    // string or an array of validation failures.
    const raw = payload?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : (raw ?? res.statusText);
    throw new ApiError(message, res.status);
  }

  return payload as T;
}

// prediction-service's errors are plain text (Go's http.Error), not the
// { message } JSON shape core-service's Nest ValidationPipe produces —
// separate request helper rather than forcing one error-parsing convention
// onto a service that doesn't use it.
async function predictionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PREDICTION_BASE_URL}${path}`, {
      credentials: 'include',
      headers: withPortal(init?.body ? { 'Content-Type': 'application/json' } : undefined),
      ...init,
    });
  } catch {
    throw new ApiError(`Cannot reach the prediction service at ${PREDICTION_BASE_URL}. Is it running?`, 0);
  }

  const text = await res.text();

  if (!res.ok) {
    throw new ApiError(text.trim() || res.statusText, res.status);
  }

  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  // `identifier` is an email address or a username — the server accepts both.
  login: (identifier: string, password: string) =>
    request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: AuthUser }>('/auth/me'),

  mySessions: () => request<SessionInfo[]>('/auth/sessions'),

  revokeMySession: (id: string) =>
    request<{ success: boolean }>(`/auth/sessions/${id}`, { method: 'DELETE' }),

  revokeMyOtherSessions: () =>
    request<{ success: boolean }>('/auth/sessions', { method: 'DELETE' }),

  listUsers: () => request<UserSummary[]>('/users'),

  getUser: (id: string) => request<UserSummary>(`/users/${id}`),

  checkUsername: (username: string) =>
    request<{ available: boolean }>(
      `/users/check-username?username=${encodeURIComponent(username)}`,
    ),

  createUser: (body: {
    email: string;
    username: string;
    password: string;
    accountType: 'ADMIN' | 'AGENT' | 'PLAYER' | 'ADMIN_STAFF' | 'AGENT_STAFF';
    /** ADMIN_STAFF/AGENT_STAFF only — the roles that give a Worker its authority. */
    roleIds?: string[];
    /** AGENT only — profit/loss slice in tenths. Omit to inherit the Admin default. */
    agentShare?: number;
    /** AGENT only — a full replacement rate card (every bet type). Omit to inherit the Admin's current default as-is. */
    rates?: { betType: BetType; multiplier: number }[];
    /** Requires token:administer. Written as an audited grant in the same txn. */
    openingBalance?: number;
  }) => request<UserSummary>('/users', { method: 'POST', body: JSON.stringify(body) }),

  statusImpact: (id: string) => request<StatusImpact>(`/users/${id}/status-impact`),

  setUserStatus: (id: string, isActive: boolean) =>
    request<UserSummary>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  // No assignAgent() here — a Player's agent is fixed at creation (whoever
  // created it) and never reassigned. See ARCHITECTURE.md "Native tier
  // authority is intrinsic".

  userSessions: (id: string) => request<SessionInfo[]>(`/users/${id}/sessions`),

  forceLogout: (id: string) =>
    request<{ success: boolean }>(`/users/${id}/sessions/revoke-all`, { method: 'POST' }),

  listRoles: () => request<Role[]>('/roles'),

  listPermissions: () => request<Permission[]>('/permissions'),

  createRole: (body: { name: string; description?: string; permissionKeys: string[] }) =>
    request<Role>('/roles', { method: 'POST', body: JSON.stringify(body) }),

  assignRole: (userId: string, roleId: string) =>
    request<UserRoleEntry[]>(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
    }),

  unassignRole: (userId: string, roleId: string) =>
    request<UserRoleEntry[]>(`/users/${userId}/roles/${roleId}`, { method: 'DELETE' }),

  // ---- Rate cards ----

  rateMeta: () => request<RateMeta>('/rates/meta'),

  myRates: () => request<MyRates>('/rates/me'),

  updateDefaultRates: (entries: { betType: string; multiplier: number }[]) =>
    request<RateEntry[]>('/rates/me/default', {
      method: 'PATCH',
      body: JSON.stringify({ entries }),
    }),

  updateGivingRates: (entries: { betType: string; multiplier: number }[]) =>
    request<RateEntry[]>('/rates/me/giving', {
      method: 'PATCH',
      body: JSON.stringify({ entries }),
    }),

  agentRates: (agentId: string) => request<AgentRateCards>(`/rates/agent/${agentId}`),

  // ---- Ledger ----

  ledger: (limit?: number) =>
    request<LedgerEntry[]>(`/ledger${limit ? `?limit=${limit}` : ''}`),

  grantTokens: (userId: string, amount: number, note?: string) =>
    request<LedgerEntry>(`/ledger/grant/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ amount, ...(note ? { note } : {}) }),
    }),

  /**
   * An Agent moving its **own** tokens to or from one of its Players —
   * positive hands them down, negative claws them back. Distinct from
   * grantTokens, which mints: an Agent can do this but can never mint.
   */
  transferTokens: (playerId: string, amount: number, note?: string) =>
    request<LedgerEntry>(`/ledger/transfer/${playerId}`, {
      method: 'POST',
      body: JSON.stringify({ amount, ...(note ? { note } : {}) }),
    }),

  // ---- Games (core-service: definition, holidays, enablement) ----

  /** Platform Admin's management view — every game, full config. */
  listGamesAsPlatformAdmin: () => request<Game[]>('/games'),

  /** Admin's view — ACTIVE games only, annotated with its own toggle. */
  listGamesAsAdmin: () => request<GameForAdmin[]>('/games'),

  createGame: (body: {
    name: string;
    description?: string;
    openTime: string;
    closeTime: string;
    /** IANA zone the clock times are read in; server defaults it when omitted. */
    timezone?: string;
    weeklyOffDays?: number[];
    minStake: number;
    maxStake: number;
  }) => request<Game>('/games', { method: 'POST', body: JSON.stringify(body) }),

  updateGame: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      openTime: string;
      closeTime: string;
      weeklyOffDays: number[];
      minStake: number;
      maxStake: number;
      status: GameStatus;
    }>,
  ) => request<Game>(`/games/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  addGameHoliday: (gameId: string, date: string, reason?: string) =>
    request<GameHoliday>(`/games/${gameId}/holidays`, {
      method: 'POST',
      body: JSON.stringify({ date, ...(reason ? { reason } : {}) }),
    }),

  removeGameHoliday: (gameId: string, date: string) =>
    request<void>(`/games/${gameId}/holidays/${date}`, { method: 'DELETE' }),

  setGameEnablement: (gameId: string, enabled: boolean) =>
    request<{ gameId: string; adminId: string; enabled: boolean }>(`/games/${gameId}/enablement`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  /**
   * Record a day's result and settle everything it decides. Send openPana
   * first; closePana is rejected until the open result exists, because the
   * jodi and both sangams combine a value from each side.
   */
  submitGameResult: (
    gameId: string,
    body: { date: string; openPana?: string; closePana?: string },
  ) =>
    request<SettlementSummary>(`/games/${gameId}/result`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * Replace a result already published — reverses every payout it caused
   * (allowing a Player's balance to go negative if the tokens are already
   * spent), resets the affected predictions, and re-grades from scratch
   * against the corrected panas. Separate endpoint from submitGameResult on
   * purpose: a plain submit still refuses to overwrite with a 409.
   */
  correctGameResult: (
    gameId: string,
    body: { date: string; openPana?: string; closePana?: string; reason?: string },
  ) =>
    request<CorrectionSummary>(`/games/${gameId}/result/correct`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** Correction history for a game, newest first. */
  gameCorrections: (gameId: string) => request<ResultCorrectionEntry[]>(`/games/${gameId}/corrections`),

  // ---- Token requests ----

  /** A Player asking for a balance change. One open request per kind at a time. */
  createTokenRequest: (body: { kind: TokenRequestKind; amount: number; note?: string }) =>
    request<TokenRequest>('/token-requests', { method: 'POST', body: JSON.stringify(body) }),

  myTokenRequests: () => request<TokenRequest[]>('/token-requests/me'),

  /** A Player withdrawing their own request before anyone acts on it. */
  cancelTokenRequest: (id: string) =>
    request<TokenRequest>(`/token-requests/${id}/cancel`, { method: 'POST' }),

  /** The review queue — an Agent/Admin (or their staff) sees their own subtree. */
  tokenRequestQueue: (status?: TokenRequestStatus) =>
    request<TokenRequest[]>(`/token-requests${status ? `?status=${status}` : ''}`),

  /** Advisory — lets other reviewers see the request is being worked. */
  claimTokenRequest: (id: string) =>
    request<TokenRequest>(`/token-requests/${id}/claim`, { method: 'POST' }),

  releaseTokenRequestClaim: (id: string) =>
    request<TokenRequest>(`/token-requests/${id}/release`, { method: 'POST' }),

  /** Moves no tokens — available to staff holding request:manage. */
  rejectTokenRequest: (id: string, resolutionNote?: string) =>
    request<TokenRequest>(`/token-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(resolutionNote ? { resolutionNote } : {}),
    }),

  /**
   * Performs the movement the request asked for — a TOP_UP as the Player's
   * own Agent (out of the Agent's wallet), or a SURRENDER as an Admin
   * (destroying the tokens). Staff are refused with an explanatory message:
   * approving moves tokens, which is the account holder's alone.
   */
  approveTokenRequest: (id: string, resolutionNote?: string) =>
    request<TokenRequest>(`/token-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(resolutionNote ? { resolutionNote } : {}),
    }),

  // ---- Predictions (core-service: read-only views) ----

  myPredictions: () => request<Prediction[]>('/predictions/me'),

  subtreePredictions: () => request<Prediction[]>('/predictions'),

  /**
   * Admin's book — totals per number, never per player. `agentIds` may hold
   * several; odds come back only when the selection resolves to exactly one.
   */
  aggregatePredictions: (filters?: { gameId?: string; date?: string; agentIds?: string[] }) => {
    const qs = new URLSearchParams();
    if (filters?.gameId) qs.set('gameId', filters.gameId);
    if (filters?.date) qs.set('date', filters.date);
    // Repeated rather than comma-joined: an id can't contain a comma, but
    // repeating is the shape Express parses natively and needs no escaping.
    for (const id of filters?.agentIds ?? []) qs.append('agentId', id);
    const s = qs.toString();
    return request<AggregateResponse>(`/predictions/aggregate${s ? `?${s}` : ''}`);
  },

  /** Persisted Admin↔Agent settlements, signs already oriented to caller. */
  settlements: (filters?: { gameId?: string; date?: string; agentId?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(filters ?? {}).filter(([, v]) => !!v) as [string, string][],
    ).toString();
    return request<SettlementsResponse>(`/predictions/settlements${qs ? `?${qs}` : ''}`);
  },

  predictionSummary: (filters?: { gameId?: string; date?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(filters ?? {}).filter(([, v]) => !!v) as [string, string][],
    ).toString();
    return request<AgentSummaryRow[]>(`/predictions/summary${qs ? `?${qs}` : ''}`);
  },

  predictionVolume: () => request<PredictionVolume>('/predictions/volume'),

  // ---- Predictions (prediction-service/Go: live games + placement) ----

  activeGames: () => predictionRequest<ActiveGame[]>('/games/active'),

  placePrediction: (body: { gameId: string; typeId: PredictionType; pickedNumber: string; stake: number }) =>
    predictionRequest<{ predictionId: string; oddsMultiplier: number; balanceAfter: number }>('/predictions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
