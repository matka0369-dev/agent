import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AgentPredictionsCard,
  Alert,
  Card,
  CreateUserForm,
  Layout,
  LedgerCard,
  MySessionsCard,
  RatesSection,
  RequestQueueCard,
  Section,
  SettlementsCard,
  Stat,
  SubtreePredictionsCard,
  TransferTokensCard,
  UserTable,
  api,
  useAuth,
  useRoutedTabs,
  type NavItem,
  type Role,
  type UserSummary,
} from './shared';

// Roles an Agent may delegate to its own staff — must match the server-side
// allow-list in AGENT_STAFF_ALLOWED_PERMISSIONS (core-service). Filtering
// here is UX only; the server re-validates regardless.
const AGENT_STAFF_ALLOWED_PERMISSION_KEYS = new Set([
  'moderation:manage',
  'report:view',
  'rate:manage',
  'request:manage',
]);

export function Dashboard() {
  const { user } = useAuth();
  const { activeId, onSelectTab } = useRoutedTabs('overview');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [me, setMe] = useState<UserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only a native Agent creates/manages its own staff roster — a staff
  // account (AGENT_STAFF) never gets to create further staff.
  const isNativeAgent = user?.accountType === 'AGENT';
  // A native Agent's moderation ability is intrinsic to the tier (matches
  // today's behavior); its staff needs the delegated permission explicitly.
  const canManagePlayers = isNativeAgent || (user?.permissions.includes('moderation:manage') ?? false);

  const staffAssignableRoles = useMemo(
    () => roles.filter((r) => r.permissions.every((rp) => AGENT_STAFF_ALLOWED_PERMISSION_KEYS.has(rp.permission.key))),
    [roles],
  );

  // Creating a Player is a native Agent's own intrinsic authority — the same
  // capability that already let it moderate its Players, extended to
  // bringing them into being in the first place. Its staff (AGENT_STAFF)
  // has no account-creation authority at all, so this is a plain
  // account-type check, not a permission.
  const canCreatePlayers = isNativeAgent;

  const nav = useMemo<NavItem[]>(
    () => [
      { id: 'overview', label: 'Overview' },
      ...(canCreatePlayers ? [{ id: 'create', label: 'Create player' }] : []),
      { id: 'players', label: 'Your players' },
      ...(isNativeAgent ? [{ id: 'move-tokens', label: 'Move tokens' }] : []),
      { id: 'rates', label: 'Given & giving' },
      { id: 'predictions', label: 'Predictions' },
      { id: 'totals', label: 'Prediction totals' },
      { id: 'settlements', label: 'Settlements' },
      { id: 'requests', label: 'Token requests' },
      { id: 'ledger', label: 'Token history' },
      ...(isNativeAgent
        ? [
            { id: 'staff-create', label: 'Create staff' },
            { id: 'staff', label: 'Your staff' },
          ]
        : []),
      { id: 'sessions', label: 'Your sessions' },
      { id: 'scope', label: 'Scope of this role' },
    ],
    [canCreatePlayers, isNativeAgent],
  );

  // The API already scopes this to players (and staff) assigned to the
  // calling Agent — there is no client-side filtering to bypass.
  const load = useCallback(async () => {
    try {
      // Role assignment is only ever shown to a native Agent creating its
      // own staff — a staff account itself has no use for the catalog.
      // `listUsers` returns this Agent's players and staff but never itself,
      // so the Agent's own wallet needs a separate self-read.
      const [u, r, self] = await Promise.all([
        api.listUsers(),
        isNativeAgent ? api.listRoles() : Promise.resolve([]),
        user ? api.getUser(user.id) : Promise.resolve(null),
      ]);
      setUsers(u);
      setRoles(r);
      setMe(self);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isNativeAgent, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const players = users.filter((u) => u.accountType === 'PLAYER');
  const staff = users.filter((u) => u.accountType === 'AGENT_STAFF');
  const active = players.filter((p) => p.isActive).length;

  return (
    <Layout
      title="Welcome, Agent"
      subtitle="Create and moderate your own players, and fund them from your own wallet."
      nav={nav}
      activeId={activeId}
      onSelectTab={onSelectTab}
    >
      {error && <Alert tone="error">{error}</Alert>}

      {!canManagePlayers && (
        <Alert tone="info">
          You don't hold the <strong>Moderator</strong> role, so player moderation is read-only.
          The Agent who created this staff account can grant one.
        </Alert>
      )}

      <Section id="overview">
        <div className="grid grid--stats">
          <Stat
            label="Your wallet"
            value={me ? me.balance.toLocaleString() : '—'}
            hint="Funded by grants from your Admin — the only way tokens reach this wallet"
          />
          <Stat label="Assigned players" value={players.length} />
          <Stat label="Active" value={active} />
          <Stat label="Disabled" value={players.length - active} />
        </div>
      </Section>

      {canCreatePlayers && (
        <Section id="create">
          <CreateUserForm allowedTypes={['PLAYER']} onCreated={() => void load()} />
        </Section>
      )}

      <Section id="players">
        <UserTable
          title="Your players"
          desc="Players you've created — a Player belongs to whichever Agent created it, permanently."
          users={players}
          canManage={canManagePlayers}
          onChanged={() => void load()}
        />
      </Section>

      {isNativeAgent && (
        <Section id="move-tokens">
          <TransferTokensCard
            players={players}
            agentBalance={me?.balance ?? 0}
            onDone={() => void load()}
          />
        </Section>
      )}

      <Section id="rates">
        <RatesSection />
      </Section>

      <Section id="predictions">
        <SubtreePredictionsCard title="Predictions" desc="Every prediction placed by your players." />
      </Section>

      {/* The Admin's per-number book, over your own players only. */}
      <Section id="totals">
        <AgentPredictionsCard />
      </Section>

      {/* The same rows the Admin sees, from your side — the two positions
          are exact mirrors, so the server flips the signs rather than
          storing them twice. */}
      <Section id="settlements">
        <SettlementsCard />
      </Section>

      <Section id="requests">
        <RequestQueueCard viewerId={user?.id} />
      </Section>

      <Section id="ledger">
        <LedgerCard
          title="Token history"
          desc="Movements on your own wallet and your players' balances."
          showDateFilter
        />
      </Section>

      {isNativeAgent && (
        <Section id="staff-create">
          <CreateUserForm allowedTypes={['AGENT_STAFF']} roles={staffAssignableRoles} onCreated={() => void load()} />
        </Section>
      )}

      {isNativeAgent && (
        <Section id="staff">
          <UserTable
            title="Your staff"
            desc="Internal logins that moderate your players on your behalf."
            users={staff}
            canManage
            onChanged={() => void load()}
          />
        </Section>
      )}

      <Section id="sessions">
        <MySessionsCard />
      </Section>

      <Section id="scope">
        <Card title="Scope of this role">
          <div className="note">
            Creating a Player and moderating it are both a native Agent's own authority — an Admin
            neither creates your Players nor reassigns them to another Agent afterward; a Player
            belongs to whoever created it, permanently. You can also move tokens to and from your
            own Players, but only ones you already hold: this wallet is funded by your Admin and
            nothing else — a stake your Player places is destroyed, not paid to you — and{' '}
            <strong>you can never create tokens</strong> —
            only an Admin can do that. That boundary is enforced by the API, not just hidden in
            the interface.
          </div>
        </Card>
      </Section>
    </Layout>
  );
}
