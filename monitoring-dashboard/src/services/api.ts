/**
 * API Service
 * Centralized API client for data warehouse endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Warehouse endpoints
  async getWarehouseSummary() {
    return this.request('/warehouse/summary');
  }

  async getSchemas() {
    return this.request('/warehouse/schemas');
  }

  async getTables(schema: string) {
    return this.request(`/warehouse/tables/${schema}`);
  }

  async getTableStats(schema: string, table: string) {
    return this.request(`/warehouse/stats/${schema}/${table}`);
  }

  async getTableData(schema: string, table: string, limit = 100, offset = 0) {
    return this.request(`/warehouse/data/${schema}/${table}?limit=${limit}&offset=${offset}`);
  }

  async getSalesStats() {
    return this.request('/warehouse/sales-stats');
  }

  async getCustomerStats() {
    return this.request('/warehouse/customer-stats');
  }

  async getTopProducts(limit: number = 20) {
    return this.request(`/warehouse/top-products?limit=${limit}`);
  }

  // Health check
  async getHealth() {
    const healthUrl = API_BASE_URL.replace('/api/v1', '') + '/health';
    const response = await fetch(healthUrl);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Monitoring endpoints
  async getETLJobs() {
    return this.request('/monitoring/etl/jobs');
  }

  async getPipelineDAG() {
    return this.request('/monitoring/etl/pipeline-dag');
  }

  async getDataFreshness() {
    return this.request('/monitoring/etl/freshness');
  }

  async getETLErrors() {
    return this.request('/monitoring/etl/errors');
  }

  async getThroughputMetrics() {
    return this.request('/monitoring/etl/throughput');
  }

  async getDataQualityMetrics() {
    return this.request('/monitoring/data-quality');
  }

  // Storage endpoints
  async getStorageUtilization() {
    return this.request('/storage/utilization');
  }

  async getGrowthTrends(days: number = 30) {
    return this.request(`/storage/growth-trends?days=${days}`);
  }

  async getCompressionStats() {
    return this.request('/storage/compression');
  }

  async getCachePerformance() {
    return this.request('/storage/cache');
  }

  async getResourceAllocation() {
    return this.request('/storage/resources');
  }

  async getCostTracking() {
    return this.request('/storage/cost');
  }

  // Alert endpoints
  async getActiveAlerts() {
    return this.request('/alerts/active');
  }

  async getAlertHistory(days: number = 30) {
    return this.request(`/alerts/history?days=${days}`);
  }

  async getAnomalies() {
    return this.request('/alerts/anomalies');
  }

  async getIncidents() {
    return this.request('/alerts/incidents');
  }

  async acknowledgeAlert(alertId: string) {
    return this.request(`/alerts/acknowledge/${alertId}`, { method: 'POST' });
  }

  async getAlertConfig() {
    return this.request('/alerts/config');
  }

  async updateAlertConfig(config: any) {
    return this.request('/alerts/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Optimization endpoints
  async getOptimizationRecommendations(type?: string, status?: string) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    const query = params.toString();
    return this.request(`/optimization/recommendations${query ? `?${query}` : ''}`);
  }

  async applyOptimization(recommendationId: string, auto: boolean = false) {
    return this.request(`/optimization/recommendations/${recommendationId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ optimization_id: recommendationId, auto }),
    });
  }

  async getQueryPerformance(startDate?: string, endDate?: string, queryId?: string, limit: number = 100) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (queryId) params.append('query_id', queryId);
    params.append('limit', limit.toString());
    return this.request(`/optimization/query-performance?${params.toString()}`);
  }

  async getOptimizationHistory(limit: number = 100) {
    return this.request(`/optimization/history?limit=${limit}`);
  }
}

export const apiService = new ApiService();



