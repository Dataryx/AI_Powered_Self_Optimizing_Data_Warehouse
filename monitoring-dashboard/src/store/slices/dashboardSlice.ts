/**
 * Dashboard Slice
 * Redux slice for dashboard state management.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DashboardState {
  realtimeMetrics: any;
  historicalMetrics: any[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  realtimeMetrics: null,
  historicalMetrics: [],
  isLoading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setRealtimeMetrics: (state, action: PayloadAction<any>) => {
      state.realtimeMetrics = action.payload;
    },
    setHistoricalMetrics: (state, action: PayloadAction<any[]>) => {
      state.historicalMetrics = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setRealtimeMetrics, setHistoricalMetrics, setLoading, setError } =
  dashboardSlice.actions;

export default dashboardSlice.reducer;
