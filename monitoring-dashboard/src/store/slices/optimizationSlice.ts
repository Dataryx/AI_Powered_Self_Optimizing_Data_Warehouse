/**
 * Optimization Slice
 * Manages optimization recommendations and history
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OptimizationRecommendation {
  id: string;
  type: 'index' | 'partition' | 'cache';
  table: string;
  columns: string[];
  estimatedImprovement: number;
  cost: number;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}

interface OptimizationState {
  recommendations: OptimizationRecommendation[];
  history: OptimizationRecommendation[];
  metrics: {
    totalApplied: number;
    totalRejected: number;
    averageImprovement: number;
  };
  isLoading: boolean;
  error: string | null;
}

const initialState: OptimizationState = {
  recommendations: [],
  history: [],
  metrics: {
    totalApplied: 0,
    totalRejected: 0,
    averageImprovement: 0,
  },
  isLoading: false,
  error: null,
};

const optimizationSlice = createSlice({
  name: 'optimization',
  initialState,
  reducers: {
    setRecommendations: (state, action: PayloadAction<OptimizationRecommendation[]>) => {
      state.recommendations = action.payload;
    },
    addRecommendation: (state, action: PayloadAction<OptimizationRecommendation>) => {
      state.recommendations.push(action.payload);
    },
    updateRecommendation: (state, action: PayloadAction<{ id: string; updates: Partial<OptimizationRecommendation> }>) => {
      const index = state.recommendations.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.recommendations[index] = { ...state.recommendations[index], ...action.payload.updates };
      }
    },
    applyRecommendation: (state, action: PayloadAction<string>) => {
      const index = state.recommendations.findIndex(r => r.id === action.payload);
      if (index !== -1) {
        const recommendation = { ...state.recommendations[index], status: 'applied' as const };
        state.history.push(recommendation);
        state.recommendations.splice(index, 1);
        state.metrics.totalApplied += 1;
      }
    },
    rejectRecommendation: (state, action: PayloadAction<string>) => {
      const index = state.recommendations.findIndex(r => r.id === action.payload);
      if (index !== -1) {
        const recommendation = { ...state.recommendations[index], status: 'rejected' as const };
        state.history.push(recommendation);
        state.recommendations.splice(index, 1);
        state.metrics.totalRejected += 1;
      }
    },
    setMetrics: (state, action: PayloadAction<Partial<OptimizationState['metrics']>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setRecommendations,
  addRecommendation,
  updateRecommendation,
  applyRecommendation,
  rejectRecommendation,
  setMetrics,
  setLoading,
  setError,
} = optimizationSlice.actions;

export default optimizationSlice.reducer;



