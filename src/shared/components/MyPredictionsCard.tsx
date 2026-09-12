import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Prediction } from '../lib/types';
import { Alert } from './ui';
import { PredictionsTable } from './PredictionsTable';

export function MyPredictionsCard({ refreshKey }: { refreshKey?: number }) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPredictions(await api.myPredictions());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <PredictionsTable
        predictions={predictions}
        title="Your predictions"
        desc="Every bet you've placed."
        showPlayer={false}
        onRefresh={() => void load()}
        refreshing={loading}
      />
    </>
  );
}
