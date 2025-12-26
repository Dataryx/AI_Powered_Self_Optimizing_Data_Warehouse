/**
 * Alert Slice
 * Redux slice for alert state management.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AlertState {
  alerts: any[];
  activeAlerts: any[];
  isLoading: boolean;
  error: string | null;
}

const initialState: AlertState = {
  alerts: [],
  activeAlerts: [],
  isLoading: false,
  error: null,
};

const alertSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlerts: (state, action: PayloadAction<any[]>) => {
      state.alerts = action.payload;
    },
    setActiveAlerts: (state, action: PayloadAction<any[]>) => {
      state.activeAlerts = action.payload;
    },
    addAlert: (state, action: PayloadAction<any>) => {
      state.alerts.push(action.payload);
      if (action.payload.status === 'active') {
        state.activeAlerts.push(action.payload);
      }
    },
    updateAlert: (state, action: PayloadAction<{ id: string; updates: any }>) => {
      const index = state.alerts.findIndex((a) => a.alert_id === action.payload.id);
      if (index !== -1) {
        state.alerts[index] = { ...state.alerts[index], ...action.payload.updates };
      }
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
  setAlerts,
  setActiveAlerts,
  addAlert,
  updateAlert,
  setLoading,
  setError,
} = alertSlice.actions;

export default alertSlice.reducer;
