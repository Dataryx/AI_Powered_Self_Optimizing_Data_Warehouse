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

// Optimization types - matching component interface
export interface OptimizationRecommendation {
  id: string;
  type: 'index' | 'partition' | 'cache';
  table: string;
  columns: string[];
  estimatedImprovement: number;
  cost: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'failed';
  description: string;
  sql?: string;
  createdAt: string;
}

export interface OptimizationHistoryItem {
  id: string;
  type: 'index' | 'partition' | 'cache';
  table: string;
  status: 'applied' | 'failed' | 'rolled_back';
  appliedAt: string;
  improvementPercent: number;
  description: string;
}

// Mock optimization recommendations
export const mockOptimizationRecommendations: OptimizationRecommendation[] = [
  {
    id: 'opt-1',
    type: 'index',
    table: 'sales_transactions',
    columns: ['customer_id', 'transaction_date'],
    estimatedImprovement: 45.2,
    cost: 125.5,
    priority: 'high',
    status: 'pending',
    description: 'Composite index on customer_id and transaction_date will improve query performance for customer transaction lookups.',
    sql: 'CREATE INDEX idx_sales_transactions_customer_date ON sales_transactions(customer_id, transaction_date);',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'opt-2',
    type: 'index',
    table: 'product_catalog',
    columns: ['category_id', 'price'],
    estimatedImprovement: 32.8,
    cost: 89.3,
    priority: 'medium',
    status: 'approved',
    description: 'Index on category_id and price will speed up category-based product filtering and sorting.',
    sql: 'CREATE INDEX idx_product_catalog_category_price ON product_catalog(category_id, price);',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'opt-3',
    type: 'partition',
    table: 'user_events',
    columns: ['event_date'],
    estimatedImprovement: 58.5,
    cost: 234.7,
    priority: 'high',
    status: 'pending',
    description: 'Partition table by event_date to improve query performance on time-based event queries.',
    sql: 'ALTER TABLE user_events PARTITION BY RANGE (event_date);',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: 'opt-4',
    type: 'cache',
    table: 'product_reviews',
    columns: ['product_id'],
    estimatedImprovement: 28.3,
    cost: 45.2,
    priority: 'low',
    status: 'applied',
    description: 'Cache frequently accessed product reviews to reduce database load.',
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 'opt-5',
    type: 'index',
    table: 'orders',
    columns: ['order_date', 'status'],
    estimatedImprovement: 38.7,
    cost: 156.3,
    priority: 'medium',
    status: 'pending',
    description: 'Composite index on order_date and status for efficient order filtering and reporting.',
    sql: 'CREATE INDEX idx_orders_date_status ON orders(order_date, status);',
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
];

export const mockOptimizationHistory: OptimizationHistoryItem[] = [
  {
    id: 'hist-1',
    type: 'index',
    table: 'user_profiles',
    status: 'applied',
    appliedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    improvementPercent: 42.5,
    description: 'Index on user_id column',
  },
  {
    id: 'hist-2',
    type: 'cache',
    table: 'product_reviews',
    status: 'applied',
    appliedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    improvementPercent: 28.3,
    description: 'Cache for product reviews',
  },
  {
    id: 'hist-3',
    type: 'index',
    table: 'order_items',
    status: 'applied',
    appliedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    improvementPercent: 35.7,
    description: 'Composite index on order_id and product_id',
  },
  {
    id: 'hist-4',
    type: 'partition',
    table: 'analytics_logs',
    status: 'failed',
    appliedAt: new Date(Date.now() - 96 * 3600000).toISOString(),
    improvementPercent: 0,
    description: 'Monthly partitioning by log_date',
  },
  {
    id: 'hist-5',
    type: 'index',
    table: 'inventory',
    status: 'applied',
    appliedAt: new Date(Date.now() - 120 * 3600000).toISOString(),
    improvementPercent: 51.2,
    description: 'Index on product_id and warehouse_id',
  },
  {
    id: 'hist-6',
    type: 'cache',
    table: 'user_sessions',
    status: 'applied',
    appliedAt: new Date(Date.now() - 144 * 3600000).toISOString(),
    improvementPercent: 33.8,
    description: 'Cache for active user sessions',
  },
];

export const mockOptimizationMetrics = {
  totalRecommendations: 24,
  appliedCount: 12,
  pendingCount: 8,
  rejectedCount: 4,
  avgImprovement: 38.5,
  totalTimeSaved: 125000, // milliseconds
};

// API functions for optimizations
export const getOptimizationRecommendations = async (
  type?: string,
  status?: string
): Promise<OptimizationRecommendation[]> => {
  try {
    const response = await api.get('/optimizations/recommendations', {
      params: { type, status },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching optimization recommendations:', error);
    // Return mock data on error
    let filtered = [...mockOptimizationRecommendations];
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (type) {
      filtered = filtered.filter((r) => r.type === type);
    }
    return filtered;
  }
};

export const getOptimizationHistory = async (): Promise<OptimizationHistoryItem[]> => {
  try {
    const response = await api.get('/optimizations/history');
    return response.data;
  } catch (error) {
    console.error('Error fetching optimization history:', error);
    return mockOptimizationHistory;
  }
};

export const getOptimizationMetrics = async () => {
  try {
    const response = await api.get('/optimizations/metrics');
    return response.data;
  } catch (error) {
    console.error('Error fetching optimization metrics:', error);
    return mockOptimizationMetrics;
  }
};

export const approveOptimization = async (id: string): Promise<void> => {
  try {
    await api.post(`/optimizations/recommendations/${id}/approve`);
  } catch (error) {
    console.error('Error approving optimization:', error);
    throw error;
  }
};

export const applyOptimization = async (id: string): Promise<void> => {
  try {
    await api.post(`/optimizations/apply/${id}`);
  } catch (error) {
    console.error('Error applying optimization:', error);
    throw error;
  }
};

export const rejectOptimization = async (id: string): Promise<void> => {
  try {
    await api.post(`/optimizations/recommendations/${id}/reject`);
  } catch (error) {
    console.error('Error rejecting optimization:', error);
    throw error;
  }
};

// Dashboard metrics interface
export interface DashboardMetrics {
  queriesToday: number;
  avgResponseTime: number;
  optimizationSavings: number;
  activeAlerts: number;
  queriesChange?: number;
  responseTimeChange?: number;
  savingsChange?: number;
}

// API function to fetch dashboard metrics
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  try {
    const response = await api.get('/dashboard/metrics');
    // Transform snake_case to camelCase if needed
    const data = response.data;
    return {
      queriesToday: data.queriesToday || data.queries_today || 0,
      avgResponseTime: data.avgResponseTime || data.avg_response_time || 0,
      optimizationSavings: data.optimizationSavings || data.optimization_savings || 0,
      activeAlerts: data.activeAlerts || data.active_alerts || 0,
      queriesChange: data.queriesChange || data.queries_change || 0,
      responseTimeChange: data.responseTimeChange || data.response_time_change || 0,
      savingsChange: data.savingsChange || data.savings_change || 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    // Return mock data on error
    return {
      queriesToday: mockMetrics.queriesToday,
      avgResponseTime: mockMetrics.avgResponseTime,
      optimizationSavings: mockMetrics.optimizationSavings,
      activeAlerts: mockMetrics.activeAlerts,
      queriesChange: 12.5,
      responseTimeChange: -8.3,
      savingsChange: 3.2,
    };
  }
};

// Query Performance interface
export interface QueryPerformancePoint {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

// API function to fetch query performance data
export const getQueryPerformance = async (): Promise<QueryPerformancePoint[]> => {
  try {
    const response = await api.get('/dashboard/query-performance');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching query performance:', error);
    // Return mock data on error
    return mockQueryPerformance;
  }
};

// Resource Utilization interface
export interface ResourceUtilization {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

// API function to fetch resource utilization
export const getResourceUtilization = async (): Promise<ResourceUtilization> => {
  try {
    const response = await api.get('/dashboard/resource-utilization');
    return response.data;
  } catch (error) {
    console.error('Error fetching resource utilization:', error);
    // Return mock data on error
    return mockResourceUsage;
  }
};
