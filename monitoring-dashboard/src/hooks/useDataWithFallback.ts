/**
 * Hook for fetching data with automatic fallback to mock data
 * when API is offline
 */

import { useState, useEffect } from 'react';
import { useApiStatus } from '../contexts/ApiStatusContext';
import { mockDataService } from '../services/mockDataService';
import { apiService } from '../services/api';

interface UseDataWithFallbackOptions<T> {
  apiCall: () => Promise<T>;
  mockCall: () => Promise<T>;
  enabled?: boolean;
}

export function useDataWithFallback<T>({
  apiCall,
  mockCall,
  enabled = true,
}: UseDataWithFallbackOptions<T>) {
  const { isOnline, isChecking } = useApiStatus();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

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

        let result: T;

        if (isOnline && !isChecking) {
          try {
            // Try real API first
            result = await apiCall();
            setIsMockData(false);
          } catch (apiError) {
            // If API fails, fallback to mock data
            console.warn('API call failed, using mock data:', apiError);
            result = await mockCall();
            setIsMockData(true);
            setError('Using mock data - API unavailable');
          }
        } else {
          // Use mock data when offline
          result = await mockCall();
          setIsMockData(true);
        }

        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load data');
          setLoading(false);
          console.error('Data fetch error:', err);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOnline, isChecking, enabled, apiCall, mockCall]);

  return { data, loading, error, isMockData };
}


