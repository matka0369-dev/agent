import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Stat, StatusBadge, UserTable, formatDate, type UserSummary } from './shared';
import { PlayerPredictions } from './PlayerPredictions';

/**
 * The "Your players" tab: the list, and a page for one player at
 * `/players/:id`. The tab stays active on the nested route (the router only
 * reads the first path segment), so the sidebar highlight doesn't move.
 *
 * A player's page is where their own predictions live, with a date range: the
 * Predictions tab is one day across everyone, this is one person across days.
 */
export function PlayersTab({
  players,
  canManage,
  canViewData,
  onChanged,
}: {
  players: UserSummary[];
  canManage: boolean;
  canViewData: boolean;
  onChanged: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const id = pathname.split('/')[2];

  if (id) {
    const player = players.find((p) => p.id === id);
    return (
      <PlayerPage
        player={player}
        canViewData={canViewData}
        onBack={() => navigate('/players')}
      />
    );
  }

  return (
    <UserTable
      title="Your players"
      desc={`Players you've created — a Player belongs to whichever Agent created it, permanently.${canViewData ? ' Click a player to see their bets.' : ''}`}
      users={players}
      canManage={canManage}
      onChanged={onChanged}
      // The username becomes a link to the player's page (UserTable's own option).
      linkTo={canViewData ? (u) => `/players/${u.id}` : undefined}
    />
  );
}

function PlayerPage({
  player,
  canViewData,
  onBack,
}: {
  player: UserSummary | undefined;
  canViewData: boolean;
  onBack: () => void;
}) {
  if (!player) {
    // A stale link, or a player this account can no longer see.
    return (
      <Card title="Player not found">
        <Empty>This player isn't one of yours, or the link is out of date.</Empty>
        <div style={{ marginTop: 12 }}>
          <Button onClick={onBack}>← Your players</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to="/players" className="btn btn--ghost btn--sm" onClick={(e) => { e.preventDefault(); onBack(); }}>
          ← Your players
        </Link>
      </div>
      <Card title={player.username} desc={`Joined ${formatDate(player.createdAt)}`}>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Stat label="Status" value={<StatusBadge active={player.isActive} />} />
          <Stat label="Tokens" value={player.balance.toLocaleString()} />
          <Stat label="Winnings" value={player.winningsBalance.toLocaleString()} />
          <Stat label="Phone" value={<span style={{ fontSize: 16, overflowWrap: 'anywhere' }}>{player.email}</span>} />
        </div>
      </Card>
      {canViewData ? (
        <PlayerPredictions player={player} />
      ) : (
        <Card><Empty>Your role can't view predictions.</Empty></Card>
      )}
    </>
  );
}
