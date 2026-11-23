import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { PlayerInvites } from './PlayerInvites';
import { PredictionsView } from './PredictionsView';
import { AgentPnl } from './AgentPnl';
import { ActivityLog } from './ActivityLog';
import { StaffRoles } from './StaffRoles';
import { PasteRequest } from './PasteRequest';
import { opsApi } from './opsApi';

// Roles an Agent may delegate to its own staff — must match the server-side
// allow-list in AGENT_STAFF_ALLOWED_PERMISSIONS (core-service). Filtering
// here is UX only; the server re-validates regardless.
const AGENT_STAFF_ALLOWED_PERMISSION_KEYS = new Set([
  'moderation:manage',
  'report:view',
  'rate:manage',
  'request:manage',
  'player:create',
  'token:transfer',
  'request:approve',
  'prediction:view',
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

  // The day-to-day work belongs to employees, not the owner account, so each
  // action is tied to a named person in the activity log (2026-11-18). The
  // owner hires staff, sets rates and numbers, and reads everything; staff do
  // only what their roles allow.
  const has = (key: string) => !isNativeAgent && (user?.permissions.includes(key as never) ?? false);
  const canCreatePlayers = has('player:create');
  const canMoveTokens = has('token:transfer');
  const canApprove = has('request:approve');
  const canTriage = isNativeAgent || has('request:manage');
  // Reading predictions, totals, settlements and the ledger.
  const canViewData = isNativeAgent || has('prediction:view');

  const nav = useMemo<NavItem[]>(
    () => [
      { id: 'overview', label: 'Overview' },
      ...(canCreatePlayers ? [{ id: 'create', label: 'Create player' }] : []),
      ...(isNativeAgent ? [{ id: 'invites', label: 'Player sign-up' }] : []),
      { id: 'players', label: 'Your players' },
      ...(canMoveTokens ? [{ id: 'move-tokens', label: 'Move tokens' }] : []),
      ...(isNativeAgent ? [{ id: 'rates', label: 'Given & giving' }] : []),
      ...(canViewData
        ? [
            { id: 'totals', label: 'Prediction totals' },
            { id: 'pnl', label: 'Profit & loss' },
            { id: 'predictions', label: 'Predictions' },
            { id: 'settlements', label: 'Settlements' },
          ]
        : []),
      ...(canTriage ? [{ id: 'requests', label: 'Token requests' }] : []),
      ...(canViewData ? [{ id: 'ledger', label: 'Token history' }] : []),
      ...(isNativeAgent
        ? [
            { id: 'staff-create', label: 'Create staff' },
            { id: 'staff', label: 'Your staff' },
            { id: 'activity', label: 'Activity log' },
          ]
        : []),
      { id: 'sessions', label: 'Your sessions' },
      { id: 'scope', label: 'Scope of this role' },
    ],
    [canCreatePlayers, canMoveTokens, canTriage, canViewData, isNativeAgent],
  );

  // The API already scopes this to players (and staff) assigned to the
  // calling Agent — there is no client-side filtering to bypass.
  const load = useCallback(async () => {
    try {
      // Role assignment is only ever shown to a native Agent creating its
      // own staff — a staff account itself has no use for the catalog.
      // `listUsers` returns this Agent's players and staff but never itself,
      // so the Agent's own wallet needs a separate self-read.
      const [u, r, wallet] = await Promise.all([
        api.listUsers(),
        isNativeAgent ? api.listRoles() : Promise.resolve([]),
        opsApi.wallet(),
      ]);
      setUsers(u);
      setRoles(r);
      setMe(wallet as unknown as UserSummary);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isNativeAgent]);

  useEffect(() => {
    void load();
  }, [load]);

  const players = users.filter((u) => u.accountType === 'PLAYER');
  const staff = users.filter((u) => u.accountType === 'AGENT_STAFF');
  const active = players.filter((p) => p.isActive).length;

  return (
    <Layout
      title="Welcome, Agent"
      subtitle={isNativeAgent ? 'Your wallet, your team and your players.' : 'Work on behalf of your agent, within your roles.'}
      nav={nav}
      activeId={activeId}
      onSelectTab={onSelectTab}
    >
      {error && <Alert tone="error">{error}</Alert>}

      {!isNativeAgent && !canManagePlayers && (
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
            hint="Funded by your Admin. Winners are paid from here, so it can go below zero until you are topped up."
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

      {isNativeAgent && (
        <Section id="invites">
          <PlayerInvites players={players} />
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

      {canMoveTokens && (
        <Section id="move-tokens">
          <TransferTokensCard
            players={players}
            agentBalance={me?.balance ?? 0}
            onDone={() => void load()}
          />
        </Section>
      )}

      {isNativeAgent && (
        <Section id="rates">
          <RatesSection />
        </Section>
      )}

      {canViewData && (
        <>
          <Section id="totals">
            <PredictionsView />
          </Section>
          <Section id="pnl">
            <AgentPnl />
          </Section>
          <Section id="predictions">
            <SubtreePredictionsCard title="Predictions" desc="Every prediction placed by your players." />
          </Section>
          {/* The same rows the Admin sees, from your side — the two positions
              are exact mirrors, so the server flips the signs rather than
              storing them twice. */}
          <Section id="settlements">
            <SettlementsCard />
          </Section>
        </>
      )}

      {canTriage && (
        <Section id="requests">
          <PasteRequest canApprove={canApprove} onChanged={() => void load()} />
          <RequestQueueCard viewerId={user?.id} />
        </Section>
      )}

      {canViewData && (
        <Section id="ledger">
          <LedgerCard
            title="Token history"
            desc="Movements on your wallet and your players' balances."
            showDateFilter
          />
        </Section>
      )}

      {isNativeAgent && (
        <Section id="staff-create">
          <CreateUserForm allowedTypes={['AGENT_STAFF']} roles={staffAssignableRoles} onCreated={() => void load()} />
        </Section>
      )}

      {isNativeAgent && (
        <Section id="staff">
          <StaffRoles staff={staff} roles={staffAssignableRoles} onChanged={() => void load()} />
          <UserTable
            title="Your staff"
            desc="Employees who work for you. Disable one here to stop their access."
            users={staff}
            canManage
            onChanged={() => void load()}
          />
        </Section>
      )}

      {isNativeAgent && (
        <Section id="activity">
          <ActivityLog staff={staff} />
        </Section>
      )}

      <Section id="sessions">
        <MySessionsCard />
      </Section>

      <Section id="scope">
        <Card title="Scope of this role">
          <div className="note">
            The owner account hires staff, sets your giving rates and WhatsApp numbers, and reads
            everything. Creating players, moving tokens and approving requests are done by staff with
            the matching role, so each action is tied to a person in the Activity log. Players sign
            themselves up. Your wallet is funded by your Admin; winners are paid from it, and you can
            never create tokens — only an Admin can. That boundary is enforced by the API, not just
            hidden in the interface.
          </div>
        </Card>
      </Section>
    </Layout>
  );
}
