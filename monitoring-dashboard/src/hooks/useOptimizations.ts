/**
 * useOptimizations Hook
 * Custom hook for optimization data and operations.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../services/api';
import {
  OptimizationRecommendation,
  OptimizationMetrics,
  OptimizationHistory,
} from '../types/api.types';

export function useOptimizations() {
  const queryClient = useQueryClient();

  // Fetch recommendations
  const {
    data: recommendations,
    isLoading: isLoadingRecommendations,
    error: recommendationsError,
  } = useQuery<OptimizationRecommendation[]>({
    queryKey: ['optimizationRecommendations'],
    queryFn: () => apiService.getOptimizationRecommendations(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch metrics
  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useQuery<OptimizationMetrics>({
    queryKey: ['optimizationMetrics'],
    queryFn: () => apiService.getOptimizationMetrics(),
    refetchInterval: 30000,
  });

  // Fetch history
  const {
    data: history,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useQuery<OptimizationHistory[]>({
    queryKey: ['optimizationHistory'],
    queryFn: () => apiService.getOptimizationHistory(),
    refetchInterval: 60000,
  });

  // Apply optimization mutation
  const applyMutation = useMutation({
    mutationFn: ({ optimizationId, auto }: { optimizationId: string; auto?: boolean }) =>
      apiService.applyOptimization(optimizationId, auto),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['optimizationRecommendations'] });
      queryClient.invalidateQueries({ queryKey: ['optimizationHistory'] });
      queryClient.invalidateQueries({ queryKey: ['optimizationMetrics'] });
    },
  });

  const applyOptimization = useCallback(
    (optimizationId: string, auto = false) => {
      applyMutation.mutate({ optimizationId, auto });
    },
    [applyMutation]
  );

  return {
    recommendations,
    metrics,
    history,
    isLoading: isLoadingRecommendations || isLoadingMetrics || isLoadingHistory,
    error: recommendationsError || metricsError || historyError,
    applyOptimization,
    isApplying: applyMutation.isPending,
  };
}


