/**
 * Redux Store
 * Centralized state management.
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
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
