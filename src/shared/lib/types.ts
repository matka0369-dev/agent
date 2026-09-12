export type AccountType = 'PLATFORM_ADMIN' | 'ADMIN' | 'AGENT' | 'PLAYER' | 'ADMIN_STAFF' | 'AGENT_STAFF';

/**
 * Permissions that actually do something when held by an ADMIN or
 * ADMIN_STAFF account. Must mirror the server's ADMIN_ASSIGNABLE_PERMISSIONS
 * (core-service/src/rbac/permissions.constants.ts) — kept in sync by hand
 * since the two packages don't share code.
 *
 * Deliberately excludes `moderation:manage`: tracing
 * UsersService.requiredPermissionToManage, that permission is checked in
 * exactly one place — an AGENT_STAFF moderating a Player. An Admin's own
 * player-moderation path is gated by `user:manage`, not this. Offering
 * "Moderator" as assignable to an Admin would render a role that authorizes
 * nothing, the same as any role held by a Player — filtering it out here is
 * UX only; the server enforces this independently and rejects it either way.
 */
export const ADMIN_ASSIGNABLE_PERMISSION_KEYS = new Set([
  'user:manage',
  'agent:manage',
  'token:administer',
  'rate:manage',
  'game:manage',
  'report:view',
]);

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  accountType: AccountType;
  agentId: string | null;
  permissions: string[];
}

export interface UserSummary {
  id: string;
  email: string;
  username: string;
  accountType: AccountType;
  isActive: boolean;
  agentId: string | null;
  /** Spendable wallet. On an Agent this also collects its Players' stakes. */
  balance: number;
  /** Where settlement pays winners. Spendable, but only after `balance`. */
  winningsBalance: number;
  createdById: string | null;
  createdAt: string;
  /** Who created this account — the hierarchy's ownership edge. */
  createdBy: { id: string; username: string; accountType: AccountType } | null;
  /** The Agent a Player sits under. Null for non-Player accounts. */
  agent: { id: string; username: string } | null;
  /** This Agent's profit/loss slice, in tenths. Only set on AGENT. */
  agentShare: number | null;
  /** Slice applied to Agents this Admin creates. Only set on ADMIN. */
  defaultAgentShare: number | null;
}

export type BetType =
  | 'SINGLE'
  | 'JODI'
  | 'SINGLE_PANA'
  | 'DOUBLE_PANA'
  | 'TRIPLE_PANA'
  | 'HALF_SANGAM'
  | 'FULL_SANGAM';

/** One row of a rate card: the payout multiplier for a single bet type. */
export interface RateEntry {
  betType: BetType;
  multiplier: number;
  updatedAt: string;
}

/** Bet taxonomy served by the API so no portal hardcodes it. */
export interface RateMeta {
  betTypes: { betType: BetType; label: string }[];
  profitShareTotal: number;
}

/**
 * Which cards the signed-in account holds. Discriminated on `kind` so a
 * dashboard can't read `given` off an Admin payload that never has one.
 */
export type MyRates =
  | { kind: 'ADMIN'; default: RateEntry[] }
  | { kind: 'AGENT'; given: RateEntry[]; giving: RateEntry[] }
  | { kind: 'PLAYER'; playing: RateEntry[] };

export interface AgentRateCards {
  agent: { id: string; username: string; agentShare: number | null };
  given: RateEntry[];
  giving: RateEntry[];
}

export type LedgerSource =
  | 'ADMIN_GRANT'
  | 'AGENT_TRANSFER'
  | 'PREDICTION_DEBIT'
  | 'PREDICTION_STAKE_IN'
  | 'PREDICTION_PAYOUT'
  | 'RESULT_CORRECTION'
  | 'TOKEN_SURRENDER';

/** Which of a user's two balances an entry moved. */
export type LedgerWallet = 'MAIN' | 'WINNINGS';

export interface LedgerEntry {
  id: string;
  delta: number;
  wallet: LedgerWallet;
  balanceAfter: number;
  source: LedgerSource;
  note: string | null;
  createdAt: string;
  user: { id: string; username: string; accountType: AccountType };
  performedBy: { id: string; username: string } | null;
}

export const LEDGER_SOURCE_LABEL: Record<LedgerSource, string> = {
  ADMIN_GRANT: 'Grant',
  AGENT_TRANSFER: 'Transfer',
  PREDICTION_DEBIT: 'Stake',
  PREDICTION_STAKE_IN: 'Stake in',
  PREDICTION_PAYOUT: 'Payout',
  RESULT_CORRECTION: 'Correction',
  TOKEN_SURRENDER: 'Surrender',
};

export const LEDGER_WALLET_LABEL: Record<LedgerWallet, string> = {
  MAIN: 'Main',
  WINNINGS: 'Winnings',
};

// ---------------------------------------------------------------------------
// Token requests — a Player asking for a balance change, in-system
// ---------------------------------------------------------------------------

export type TokenRequestKind = 'TOP_UP' | 'SURRENDER';
export type TokenRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const TOKEN_REQUEST_KIND_LABEL: Record<TokenRequestKind, string> = {
  TOP_UP: 'Top-up',
  SURRENDER: 'Surrender',
};

/**
 * A Player's request for a balance change, and its review trail.
 *
 * Deliberately carries no attachment and no external reference — see
 * ARCHITECTURE.md "Hard safety boundaries". `claimedBy` is advisory (so a
 * queue worked by several reviewers doesn't collide); the actual protection
 * against a double-approve is server-side atomicity, not this field.
 */
export interface TokenRequest {
  id: string;
  kind: TokenRequestKind;
  status: TokenRequestStatus;
  amount: number;
  note: string | null;
  claimedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  requester: { id: string; username: string; agentId: string | null };
  claimedBy: { id: string; username: string } | null;
  resolvedBy: { id: string; username: string } | null;
  /** The ledger row this request produced once approved. Null until then. */
  ledgerEntryId: string | null;
}

// ---------------------------------------------------------------------------
// Prediction games
// ---------------------------------------------------------------------------

export type GameStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface GameHoliday {
  id: string;
  gameId: string;
  date: string;
  reason: string | null;
  createdAt: string;
}

/** Platform Admin's management view — every game, full config. */
export interface Game {
  id: string;
  name: string;
  description: string | null;
  status: GameStatus;
  /** "HH:mm", 24-hour, UTC. */
  openTime: string;
  closeTime: string;
  /** IANA zone the clock times and this game's round dates are in. */
  timezone: string;
  weeklyOffDays: number[];
  minStake: number;
  maxStake: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  holidays: GameHoliday[];
}

/** An Admin's view of an ACTIVE game — its config plus its own toggle. */
export interface GameForAdmin {
  id: string;
  name: string;
  description: string | null;
  status: GameStatus;
  openTime: string;
  closeTime: string;
  weeklyOffDays: number[];
  minStake: number;
  maxStake: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

// The 11 things a Player can bet on. Every OPEN_/CLOSE_ pair shares one odds
// rate with its family (see BetType) — this only decides cutoff timing and
// the picked-number format.
export type PredictionType =
  | 'OPEN_SINGLE'
  | 'CLOSE_SINGLE'
  | 'JODI'
  | 'OPEN_SINGLE_PANA'
  | 'CLOSE_SINGLE_PANA'
  | 'OPEN_DOUBLE_PANA'
  | 'CLOSE_DOUBLE_PANA'
  | 'OPEN_TRIPLE_PANA'
  | 'CLOSE_TRIPLE_PANA'
  | 'HALF_SANGAM'
  | 'FULL_SANGAM';

export const PREDICTION_TYPE_LABEL: Record<PredictionType, string> = {
  OPEN_SINGLE: 'Single (Open)',
  CLOSE_SINGLE: 'Single (Close)',
  JODI: 'Jodi',
  OPEN_SINGLE_PANA: 'Single Pana (Open)',
  CLOSE_SINGLE_PANA: 'Single Pana (Close)',
  OPEN_DOUBLE_PANA: 'Double Pana (Open)',
  CLOSE_DOUBLE_PANA: 'Double Pana (Close)',
  OPEN_TRIPLE_PANA: 'Triple Pana (Open)',
  CLOSE_TRIPLE_PANA: 'Triple Pana (Close)',
  HALF_SANGAM: 'Half Sangam',
  FULL_SANGAM: 'Full Sangam',
};

/** Every prediction type, grouped by which side's cutoff gates it. Mirrors
 * prediction-service's Type.CutoffGroup() — JODI and both Sangams are
 * open-cutoff despite having no open/close split of their own. */
export const OPEN_CUTOFF_TYPES: PredictionType[] = [
  'OPEN_SINGLE',
  'JODI',
  'OPEN_SINGLE_PANA',
  'OPEN_DOUBLE_PANA',
  'OPEN_TRIPLE_PANA',
  'HALF_SANGAM',
  'FULL_SANGAM',
];
export const CLOSE_CUTOFF_TYPES: PredictionType[] = [
  'CLOSE_SINGLE',
  'CLOSE_SINGLE_PANA',
  'CLOSE_DOUBLE_PANA',
  'CLOSE_TRIPLE_PANA',
];

export type PredictionOutcome = 'PENDING' | 'WON' | 'LOST';

/** A placed bet, as returned by core-service's read-only views. */
export interface Prediction {
  id: string;
  typeId: PredictionType;
  pickedNumber: string;
  stake: number;
  oddsMultiplier: number;
  outcome: PredictionOutcome;
  payout: number | null;
  createdAt: string;
  user: { id: string; username: string };
  round: { id: string; date: string; game: { id: string; name: string } };
}

export interface PredictionVolume {
  totalStake: number;
  totalPredictions: number;
  byAdmin: { adminId: string; adminUsername: string; predictionCount: number; totalStake: number }[];
}

/** Platform Admin's rollup view of one Admin's business — counts and play
 * volume, never the individual accounts or predictions underneath. */
export interface AdminBusinessSummary {
  adminId: string;
  username: string;
  createdAt: string;
  agents: { total: number; active: number };
  players: { total: number; active: number };
  predictions: {
    totalCount: number;
    totalStake: number;
    dailyAverageCount: number;
    dailyAverageStake: number;
  };
}

/** One aggregated line of an Admin's book: how much is riding on a number. */
export interface AggregateRow {
  gameId: string;
  gameName: string;
  date: string;
  typeId: PredictionType;
  pickedNumber: string;
  betCount: number;
  totalStake: number;
  /** Null unless a single agent is selected — rates differ per agent. */
  odds: number | null;
}

export interface AggregateResponse {
  singleAgent: boolean;
  rows: AggregateRow[];
}

export interface AgentSummaryRow {
  agentId: string;
  agentUsername: string;
  gameId: string;
  gameName: string;
  date: string;
  betCount: number;
  totalStake: number;
  totalPayout: number;
  /** Stake collected minus paid out — the book, not any one tier's P&L. */
  net: number;
  pendingCount: number;
}

/** What a submitted result settled. */
export interface SettlementSummary {
  gameId: string;
  date: string;
  openPana: string | null;
  closePana: string | null;
  openSingle: number | null;
  closeSingle: number | null;
  settledSide: 'OPEN' | 'CLOSE' | null;
  settledCount: number;
  wonCount: number;
  lostCount: number;
  totalPaidOut: number;
  /** Admin↔Agent settlement rows written or refreshed by this submission. */
  agentsSettled: number;
}

/**
 * What replacing a published result undid and then decided.
 *
 * Extends the ordinary settlement numbers with the reversal figures — an
 * operator correcting a typo needs to see both how many bets were re-graded
 * *and* how many tokens were clawed back, because those are different facts
 * that can each surprise them independently.
 */
export interface CorrectionSummary {
  gameId: string;
  date: string;
  previousOpenPana: string | null;
  previousClosePana: string | null;
  openPana: string | null;
  closePana: string | null;
  openSingle: number | null;
  closeSingle: number | null;
  /** Predictions returned to PENDING before re-grading. */
  predictionsReset: number;
  /** Tokens clawed back out of WINNINGS. */
  payoutsReversed: number;
  /** Accounts the claw-back pushed below zero — expected, not an error. */
  accountsLeftNegative: number;
  settledCount: number;
  wonCount: number;
  lostCount: number;
  totalPaidOut: number;
  agentsSettled: number;
}

/** One entry in a game's correction history. */
export interface ResultCorrectionEntry {
  id: string;
  date: string;
  previousOpenPana: string | null;
  previousClosePana: string | null;
  newOpenPana: string | null;
  newClosePana: string | null;
  predictionsReset: number;
  payoutsReversed: number;
  accountsLeftNegative: number;
  reason: string | null;
  createdAt: string;
  performedBy: { id: string; username: string };
}

/** One winning number on a settlement, priced at the admin→agent rate. */
export interface SettlementLine {
  typeId: PredictionType;
  pickedNumber: string;
  stake: number;
  agentOdds: number;
  payout: number;
}

/**
 * The Admin↔Agent position for one game on one day.
 *
 * Signs arrive already oriented for whoever asked — the server negates them
 * for an Agent — so a component never has to work out whose side it's on.
 * `totalStaked` positive means "owed to you"; `net` is the bottom line.
 */
export interface SettlementRow {
  id: string;
  date: string;
  gameId: string;
  gameName: string;
  agentId: string;
  agentUsername: string;
  adminId: string;
  adminUsername: string;
  openPana: string | null;
  closePana: string | null;
  totalStaked: number;
  totalPayout: number;
  net: number;
  lines: SettlementLine[];
}

export interface SettlementsResponse {
  /** True when the caller is the Agent side, i.e. the signs were flipped. */
  viewerIsAgent: boolean;
  /** The date actually shown — the latest settled one when none was asked for. */
  date: string | null;
  rows: SettlementRow[];
}

/** A game a Player can currently bet on, as served by prediction-service
 * (Go) — richer than core-service's Game/GameForAdmin: it's already
 * resolved to today's Round and carries a ready-to-render cutoff per type. */
export interface ActiveGame {
  gameId: string;
  name: string;
  description: string | null;
  minStake: number;
  maxStake: number;
  roundId: string;
  date: string;
  opensAt: string;
  closesAt: string;
  cutoffs: Record<PredictionType, string>;
}

/** Blast radius of toggling an account's status, shown before confirming. */
export interface StatusImpact {
  username: string;
  accountType: AccountType;
  isActive: boolean;
  nextIsActive: boolean;
  affectedCount: number;
  affectedByType: Partial<Record<AccountType, number>>;
  sessionsToRevoke: number;
}

export interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: { permission: Permission }[];
}

export interface UserRoleEntry {
  userId: string;
  roleId: string;
  assignedAt: string;
  role: Role;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  ADMIN: 'Admin',
  AGENT: 'Agent',
  PLAYER: 'Player',
  ADMIN_STAFF: 'Admin Staff',
  AGENT_STAFF: 'Agent Staff',
};

/**
 * Each account type gets its own app on its own port. Kept here (rather than
 * in each app) so a portal can point you at the right one when you sign in to
 * the wrong portal — the session cookie is shared across localhost ports, so
 * landing in the wrong place is easy to do.
 *
 * Dev ports only; a real deployment would use hostnames per portal.
 */
export const PORTALS: Record<AccountType, { name: string; devPort: number }> = {
  PLATFORM_ADMIN: { name: 'Platform Admin', devPort: 5173 },
  ADMIN: { name: 'Admin', devPort: 5174 },
  AGENT: { name: 'Agent', devPort: 5175 },
  PLAYER: { name: 'Player', devPort: 5176 },
  // Staff accounts share their creator's portal — see Portal.tsx.
  ADMIN_STAFF: { name: 'Admin', devPort: 5174 },
  AGENT_STAFF: { name: 'Agent', devPort: 5175 },
};
