import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { PredictionVolume } from '../lib/types';
import { Alert, Card, Empty, Stat, TableWrap } from './ui';

// Platform Admin has no interest in any individual bet — "who bet what" is
// entirely below its tier — but does need to know how much volume the
// platform is moving, and by which Admin. Aggregate only; there is no route
// anywhere that lets a Platform Admin list actual Prediction rows.
export function PredictionVolumeCard() {
  const [volume, setVolume] = useState<PredictionVolume | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVolume(await api.predictionVolume());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!volume) return null;

  return (
    <>
      <div className="grid grid--stats">
        <Stat label="Total tokens staked" value={volume.totalStake.toLocaleString()} />
        <Stat label="Predictions placed" value={volume.totalPredictions.toLocaleString()} />
        <Stat label="Admins with activity" value={volume.byAdmin.length} />
      </div>

      <Card title="Volume by Admin" desc="Total stake moved under each Admin's subtree." flush>
        {volume.byAdmin.length === 0 ? (
          <Empty>No predictions placed yet.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Admin</th>
                <th style={{ textAlign: 'right' }}>Predictions</th>
                <th style={{ textAlign: 'right' }}>Total staked</th>
              </tr>
            </thead>
            <tbody>
              {volume.byAdmin.map((row) => (
                <tr key={row.adminId}>
                  <td className="cell-strong">{row.adminUsername}</td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>
                    {row.predictionCount.toLocaleString()}
                  </td>
                  <td className="cell-num" style={{ textAlign: 'right' }}>
                    {row.totalStake.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
