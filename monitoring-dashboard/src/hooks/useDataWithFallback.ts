/**
 * Fetch from API only — no mock/synthetic fallback data.
 */

import { useState, useEffect } from 'react';
import { useApiStatus } from '../contexts/ApiStatusContext';

interface UseDataWithFallbackOptions<T> {
  apiCall: () => Promise<T>;
  enabled?: boolean;
}

export function useDataWithFallback<T>({
  apiCall,
  enabled = true,
}: UseDataWithFallbackOptions<T>) {
  const { isOnline, isChecking } = useApiStatus();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!isOnline || isChecking) {
          if (isMounted) {
            setData(null);
            setError(null);
            setLoading(false);
          }
          return;
        }

        const result = await apiCall();
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
          console.error('Data fetch error:', err);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOnline, isChecking, enabled, apiCall]);

  /** Kept for compatibility; always false (no mock data path). */
  const isMockData = false;

  return { data, loading, error, isMockData };
}
