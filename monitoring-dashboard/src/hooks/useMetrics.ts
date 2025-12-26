/**
 * useMetrics Hook
 * Custom hook for real-time and historical metrics.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../services/api';
import { useWebSocket } from './useWebSocket';
import { RealtimeMetrics, HistoricalMetrics } from '../types/api.types';

interface UseRealtimeMetricsOptions {
  enabled?: boolean;
}

export function useRealtimeMetrics(options: UseRealtimeMetricsOptions = {}) {
  const { enabled = true } = options;
  const [realTimeData, setRealTimeData] = useState<RealtimeMetrics | null>(null);

  const { messages } = useWebSocket({ channels: ['metrics'], autoConnect: enabled });

  // Fetch initial metrics
  const {
    data: initialMetrics,
    isLoading,
    error,
    refetch,
  } = useQuery<RealtimeMetrics>({
    queryKey: ['realtimeMetrics'],
    queryFn: () => apiService.getRealtimeMetrics(),
    enabled,
    refetchInterval: 5000,
  });

  // Update from WebSocket messages
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.channel === 'metrics') {
      setRealTimeData(latestMessage.data);
    }
  }, [messages]);

  // Use WebSocket data if available, otherwise use API data
  const metrics = realTimeData || initialMetrics;

  return {
    metrics,
    isLoading,
    error,
    refetch,
  };
}

interface UseHistoricalMetricsOptions {
  startDate: string;
  endDate: string;
  metricType?: string;
  interval?: string;
  enabled?: boolean;
}

export function useHistoricalMetrics(options: UseHistoricalMetricsOptions) {
  const { startDate, endDate, metricType, interval = '1h', enabled = true } = options;

  const {
    data: historicalMetrics,
    isLoading,
    error,
    refetch,
  } = useQuery<HistoricalMetrics[]>({
    queryKey: ['historicalMetrics', startDate, endDate, metricType, interval],
    queryFn: () => apiService.getHistoricalMetrics(startDate, endDate, metricType, interval),
    enabled,
  });

  return {
    historicalMetrics,
    isLoading,
    error,
    refetch,
  };
}


