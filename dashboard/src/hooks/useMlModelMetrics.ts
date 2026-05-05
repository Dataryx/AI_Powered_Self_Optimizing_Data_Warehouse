import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export type MlModelMetricsPayload = Awaited<ReturnType<typeof api.getMlModelMetrics>>;

export function useMlModelMetrics() {
  const [data, setData] = useState<MlModelMetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .getMlModelMetrics()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
