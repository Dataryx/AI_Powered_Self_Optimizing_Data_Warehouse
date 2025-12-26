/**
 * Optimization Slice
 * Redux slice for optimization state management.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OptimizationState {
  recommendations: any[];
  history: any[];
  metrics: any;
  isLoading: boolean;
  error: string | null;
}

const initialState: OptimizationState = {
  recommendations: [],
  history: [],
  metrics: null,
  isLoading: false,
  error: null,
};

const optimizationSlice = createSlice({
  name: 'optimization',
  initialState,
  reducers: {
    setRecommendations: (state, action: PayloadAction<any[]>) => {
      state.recommendations = action.payload;
    },
    setHistory: (state, action: PayloadAction<any[]>) => {
      state.history = action.payload;
    },
    setMetrics: (state, action: PayloadAction<any>) => {
      state.metrics = action.payload;
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
  setHistory,
  setMetrics,
  setLoading,
  setError,
} = optimizationSlice.actions;

export default optimizationSlice.reducer;
