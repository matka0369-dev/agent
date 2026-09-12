import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { GameForAdmin } from '../lib/types';
import { Alert, Card, Empty, RefreshButton, TableWrap } from './ui';

// An Admin's single on/off switch per game — no separate layer beneath it.
// Flipping this is what "the player can predict it when enabled" actually
// means: it reaches every Agent and Player under this Admin immediately,
// nothing else in the hierarchy gates it further.
export function GameEnablementCard() {
  const [games, setGames] = useState<GameForAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGames(await api.listGamesAsAdmin());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(game: GameForAdmin) {
    setPendingId(game.id);
    setError(null);
    try {
      await api.setGameEnablement(game.id, !game.enabled);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card
      title="Games"
      desc="Enable a game to make it available to every Agent and Player in your subtree."
      flush
      action={<RefreshButton onClick={() => void load()} refreshing={loading} />}
    >
      {error && (
        <div style={{ padding: '16px 16px 0' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {loading ? (
        <Empty>Loading…</Empty>
      ) : games.length === 0 ? (
        <Empty>No active games yet — check back once Platform Admin has published one.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Open</th>
              <th>Close</th>
              <th style={{ textAlign: 'right' }}>Stake range</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id}>
                <td className="cell-strong">{g.name}</td>
                <td className="cell-num">{g.openTime}</td>
                <td className="cell-num">{g.closeTime}</td>
                <td className="cell-num" style={{ textAlign: 'right' }}>
                  {g.minStake}–{g.maxStake}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <label className="checkbox-list__item" style={{ justifyContent: 'flex-end' }}>
                    <span>{g.enabled ? 'Enabled' : 'Disabled'}</span>
                    <input
                      type="checkbox"
                      checked={g.enabled}
                      disabled={pendingId === g.id}
                      onChange={() => void toggle(g)}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
