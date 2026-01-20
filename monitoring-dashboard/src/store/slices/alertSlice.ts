/**
 * Alert Slice
 * Manages alerts and notifications
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  source?: string;
}

interface AlertState {
  alerts: Alert[];
  activeAlerts: Alert[];
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
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.unshift(action.payload);
      if (!action.payload.acknowledged) {
        state.activeAlerts.push(action.payload);
      }
      // Keep only last 100 alerts
      if (state.alerts.length > 100) {
        state.alerts.pop();
      }
    },
    acknowledgeAlert: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find(a => a.id === action.payload);
      if (alert) {
        alert.acknowledged = true;
        state.activeAlerts = state.activeAlerts.filter(a => a.id !== action.payload);
      }
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(a => a.id !== action.payload);
      state.activeAlerts = state.activeAlerts.filter(a => a.id !== action.payload);
    },
    clearAlerts: (state) => {
      state.alerts = [];
      state.activeAlerts = [];
    },
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload;
      state.activeAlerts = action.payload.filter(a => !a.acknowledged);
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
  addAlert,
  acknowledgeAlert,
  removeAlert,
  clearAlerts,
  setAlerts,
  setLoading,
  setError,
} = alertSlice.actions;

export default alertSlice.reducer;



