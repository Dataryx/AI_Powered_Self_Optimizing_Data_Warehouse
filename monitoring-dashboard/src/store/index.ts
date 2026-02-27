/**
 * Redux Store Configuration
 * Centralized state management for the monitoring dashboard
 */

import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from './slices/dashboardSlice';
import optimizationReducer from './slices/optimizationSlice';
import alertReducer from './slices/alertSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    optimization: optimizationReducer,
    alerts: alertReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['dashboard/setMetrics', 'alerts/addAlert'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;






















