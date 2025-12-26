/**
 * Constants
 * Application-wide constants.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export const REFRESH_INTERVALS = {
  METRICS: 5000, // 5 seconds
  ALERTS: 10000, // 10 seconds
  OPTIMIZATIONS: 30000, // 30 seconds
};

export const CHART_COLORS = {
  PRIMARY: '#1976d2',
  SECONDARY: '#dc004e',
  SUCCESS: '#2e7d32',
  WARNING: '#ed6c02',
  ERROR: '#d32f2f',
};
