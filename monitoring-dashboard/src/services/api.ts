import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock data generators for development
export const mockMetrics = {
  queriesToday: 15234,
  avgResponseTime: 145,
  optimizationSavings: 23.5,
  activeAlerts: 2,
};

export const mockQueryPerformance = Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
  p50: 50 + Math.random() * 30,
  p95: 150 + Math.random() * 100,
  p99: 300 + Math.random() * 200,
  avg: 100 + Math.random() * 80,
}));

export const mockResourceUsage = {
  cpu: 45.2,
  memory: 67.8,
  disk: 34.5,
  network: 23.1,
};
