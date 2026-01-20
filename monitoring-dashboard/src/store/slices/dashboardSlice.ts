/**
 * Dashboard Slice
 * Manages dashboard metrics and real-time data
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Metric {
  timestamp: string;
  value: number;
  label: string;
}

interface DashboardState {
  realTimeMetrics: {
    queryLatency: Metric[];
    cpuUsage: Metric[];
    memoryUsage: Metric[];
    diskIO: Metric[];
  };
  historicalMetrics: {
    queryLatency: Metric[];
    cpuUsage: Metric[];
    memoryUsage: Metric[];
    diskIO: Metric[];
  };
  isLoading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  realTimeMetrics: {
    queryLatency: [],
    cpuUsage: [],
    memoryUsage: [],
    diskIO: [],
  },
  historicalMetrics: {
    queryLatency: [],
    cpuUsage: [],
    memoryUsage: [],
    diskIO: [],
  },
  isLoading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setMetrics: (state, action: PayloadAction<Partial<DashboardState['realTimeMetrics']>>) => {
      state.realTimeMetrics = { ...state.realTimeMetrics, ...action.payload };
    },
    addMetric: (state, action: PayloadAction<{ type: keyof DashboardState['realTimeMetrics']; metric: Metric }>) => {
      const { type, metric } = action.payload;
      state.realTimeMetrics[type].push(metric);
      // Keep only last 100 metrics
      if (state.realTimeMetrics[type].length > 100) {
        state.realTimeMetrics[type].shift();
      }
    },
    setHistoricalMetrics: (state, action: PayloadAction<Partial<DashboardState['historicalMetrics']>>) => {
      state.historicalMetrics = { ...state.historicalMetrics, ...action.payload };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearMetrics: (state) => {
      state.realTimeMetrics = initialState.realTimeMetrics;
    },
  },
});

export const {
  setMetrics,
  addMetric,
  setHistoricalMetrics,
  setLoading,
  setError,
  clearMetrics,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;



