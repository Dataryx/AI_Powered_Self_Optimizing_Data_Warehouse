/**
 * API Service
 * Centralized API client for backend communication.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common errors
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Warehouse endpoints
  async getWarehouseStats() {
    const response = await this.client.get('/warehouse/stats');
    return response.data;
  }

  async getTablesByLayer(layer: string, limit = 100, offset = 0) {
    const response = await this.client.get(`/warehouse/tables/${layer}`, {
      params: { limit, offset },
    });
    return response.data;
  }

  async getQueryHistory(startDate: string, endDate: string, limit = 100, offset = 0) {
    const response = await this.client.get('/warehouse/query-history', {
      params: { start_date: startDate, end_date: endDate, limit, offset },
    });
    return response.data;
  }

  async executeQuery(query: string) {
    const response = await this.client.post('/warehouse/query/execute', { query });
    return response.data;
  }

  async getQueryPlan(queryId: string) {
    const response = await this.client.get(`/warehouse/query/${queryId}/plan`);
    return response.data;
  }

  // Optimization endpoints
  async getOptimizationRecommendations(type?: string, status?: string, limit = 100) {
    const response = await this.client.get('/optimization/recommendations', {
      params: { type, status, limit },
    });
    return response.data;
  }

  async getOptimizationHistory(limit = 100, offset = 0) {
    const response = await this.client.get('/optimization/history', {
      params: { limit, offset },
    });
    return response.data;
  }

  async applyOptimization(optimizationId: string, auto = false) {
    const response = await this.client.post(`/optimization/apply/${optimizationId}`, null, {
      params: { auto },
    });
    return response.data;
  }

  async getOptimizationMetrics() {
    const response = await this.client.get('/optimization/metrics');
    return response.data;
  }

  async getOptimizationFeedback(optimizationId: string) {
    const response = await this.client.get(`/optimization/feedback/${optimizationId}`);
    return response.data;
  }

  // Monitoring endpoints
  async getRealtimeMetrics() {
    const response = await this.client.get('/monitoring/metrics/realtime');
    return response.data;
  }

  async getHistoricalMetrics(
    startDate: string,
    endDate: string,
    metricType?: string,
    interval = '1h'
  ) {
    const response = await this.client.get('/monitoring/metrics/historical', {
      params: { start_date: startDate, end_date: endDate, metric_type: metricType, interval },
    });
    return response.data;
  }

  async getActiveAlerts(severity?: string, limit = 100) {
    const response = await this.client.get('/monitoring/alerts/active', {
      params: { severity, limit },
    });
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.client.get('/monitoring/health');
    return response.data;
  }

  async getLogs(level?: string, startDate?: string, endDate?: string, limit = 100) {
    const response = await this.client.get('/monitoring/logs', {
      params: { level, start_date: startDate, end_date: endDate, limit },
    });
    return response.data;
  }
}

export const apiService = new APIService();
export default apiService;


