/**
 * useQueryPerformance Hook
 * Custom hook for query performance data.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../services/api';
import { QueryHistoryItem } from '../types/api.types';

interface UseQueryPerformanceOptions {
  startDate: string;
  endDate: string;
  enabled?: boolean;
}

export function useQueryPerformance(options: UseQueryPerformanceOptions) {
  const { startDate, endDate, enabled = true } = options;

  const {
    data: queryHistory,
    isLoading,
    error,
    refetch,
  } = useQuery<QueryHistoryItem[]>({
    queryKey: ['queryHistory', startDate, endDate],
    queryFn: () => apiService.getQueryHistory(startDate, endDate),
    enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Calculate statistics
  const stats = queryHistory
    ? {
        totalQueries: queryHistory.length,
        avgExecutionTime: queryHistory.reduce((sum, q) => sum + q.execution_time_ms, 0) / queryHistory.length || 0,
        minExecutionTime: Math.min(...queryHistory.map((q) => q.execution_time_ms)),
        maxExecutionTime: Math.max(...queryHistory.map((q) => q.execution_time_ms)),
        totalRowsReturned: queryHistory.reduce((sum, q) => sum + q.rows_returned, 0),
      }
    : null;

  return {
    queryHistory,
    stats,
    isLoading,
    error,
    refetch,
  };
}


