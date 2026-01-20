/**
 * useRealtimeData Hook
 * Custom hook for managing real-time data fetching with polling
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseRealtimeDataOptions {
  fetchFunction: () => Promise<any>;
  interval?: number; // Polling interval in milliseconds
  enabled?: boolean; // Whether polling is enabled
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export const useRealtimeData = <T = any>({
  fetchFunction,
  interval = 10000, // Default 10 seconds
  enabled = true,
  onSuccess,
  onError,
}: UseRealtimeDataOptions) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current || !enabled) return;

    try {
      setLoading(true);
      const result = await fetchFunction();
      
      if (isMountedRef.current) {
        setData(result);
        setError(null);
        setLastUpdate(new Date());
        onSuccess?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFunction, enabled, onSuccess, onError]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    if (enabled && interval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, interval);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, enabled, interval]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh,
  };
};

