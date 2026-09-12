import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Prediction } from '../lib/types';
import { Alert } from './ui';
import { PredictionsTable } from './PredictionsTable';

// Agent sees its own Players' predictions; Admin sees its whole subtree —
// scoping happens server-side (PredictionsService.listForSubtree), so this
// renders whatever it's given without filtering.
export function SubtreePredictionsCard({ title, desc }: { title?: string; desc?: string }) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPredictions(await api.subtreePredictions());
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

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <PredictionsTable
        predictions={predictions}
        title={title}
        desc={desc}
        onRefresh={() => void load()}
        refreshing={loading}
      />
    </>
  );
}
