/**
 * Metrics Service
 * Service for metrics-related operations.
 */

import apiService from './api';
import { RealtimeMetrics, HistoricalMetrics } from '../types/api.types';

class MetricsService {
  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    return apiService.getRealtimeMetrics();
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(
    startDate: string,
    endDate: string,
    metricType?: string,
    interval = '1h'
  ): Promise<HistoricalMetrics[]> {
    return apiService.getHistoricalMetrics(startDate, endDate, metricType, interval);
  }

  /**
   * Get system health
   */
  async getSystemHealth() {
    return apiService.getSystemHealth();
  }
}

export const metricsService = new MetricsService();
export default metricsService;
