import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface WarehouseSummary {
  bronze: { table_count: number; estimated_rows: number; total_size?: string };
  silver: { table_count: number; estimated_rows: number; total_size?: string };
  gold: { table_count: number; estimated_rows: number; total_size?: string };
}

export interface SalesStats {
  total_sales?: { count?: number; revenue?: number; avg_sale?: number };
  daily_sales?: Array<{ date: string; count?: number; sales?: number; revenue?: number }>;
  top_products?: Array<{ product?: string; product_name?: string; revenue?: number; sales_count?: number }>;
}

export interface DashboardData {
  summary: { warehouse_summary?: WarehouseSummary; database?: string } | null;
  sales: SalesStats | null;
  customers: { total_customers?: number } | null;
  alerts: { alerts?: Array<{ type?: string; severity?: string; title?: string; message?: string; timestamp?: string }> } | null;
  health: Record<string, unknown> | null;
}

const defaultData: DashboardData = {
  summary: null,
  sales: null,
  customers: null,
  alerts: null,
  health: null,
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, sales, customers, alerts, health] = await Promise.allSettled([
        api.getWarehouseSummary(),
        api.getSalesStats(),
        api.getCustomerStats(),
        api.getActiveAlerts(),
        api.getHealth(),
      ]);

      setData({
        summary: summary.status === 'fulfilled' ? summary.value : null,
        sales: sales.status === 'fulfilled' ? sales.value : null,
        customers: customers.status === 'fulfilled' ? customers.value : null,
        alerts: alerts.status === 'fulfilled' ? alerts.value : null,
        health: health.status === 'fulfilled' ? health.value : null,
      });
      if (
        summary.status === 'rejected' &&
        sales.status === 'rejected' &&
        customers.status === 'rejected'
      ) {
        setError(summary.reason?.message ?? 'Failed to load dashboard data');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}






