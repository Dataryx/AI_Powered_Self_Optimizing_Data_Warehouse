import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useDashboardRefreshIntervalMs } from './useMonitoringPreferences';

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

/** Deduplicate concurrent home-dashboard fetches (e.g. React StrictMode double mount). */
let homeDashboardInflight: Promise<DashboardData> | null = null;

function loadHomeDashboardOnce(): Promise<DashboardData> {
  if (!homeDashboardInflight) {
    homeDashboardInflight = (async (): Promise<DashboardData> => {
      const bundle = await api.getHomeDashboard();
      return {
        summary: (bundle.summary ?? null) as DashboardData['summary'],
        sales: (bundle.sales ?? null) as SalesStats | null,
        customers: (bundle.customers ?? null) as DashboardData['customers'],
        alerts: (bundle.alerts ?? null) as DashboardData['alerts'],
        health: (bundle.health ?? null) as DashboardData['health'],
      };
    })().finally(() => {
      homeDashboardInflight = null;
    });
  }
  return homeDashboardInflight;
}

async function fetchDashboardLegacyParallel(): Promise<DashboardData> {
  const [summary, sales, customers, alerts, health] = await Promise.allSettled([
    api.getWarehouseSummary(),
    api.getSalesStats(),
    api.getCustomerStats(),
    api.getActiveAlerts(),
    api.getHealth(),
  ]);

  return {
    summary: summary.status === 'fulfilled' ? summary.value : null,
    sales: sales.status === 'fulfilled' ? sales.value : null,
    customers: customers.status === 'fulfilled' ? customers.value : null,
    alerts: alerts.status === 'fulfilled' ? alerts.value : null,
    health: health.status === 'fulfilled' ? health.value : null,
  };
}

export function useDashboardData() {
  const pollIntervalMs = useDashboardRefreshIntervalMs();
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      let next: DashboardData;

      try {
        next = await loadHomeDashboardOnce();
      } catch (first: unknown) {
        const msg = first instanceof Error ? first.message : String(first);
        const isNotFound = /\b404\b|Not Found/i.test(msg);
        if (!isNotFound) {
          throw first;
        }
        next = await fetchDashboardLegacyParallel();
      }

      setData(next);

      if (
        next.summary == null &&
        next.sales == null &&
        next.customers == null
      ) {
        setError('Failed to load dashboard data');
      } else {
        setError(null);
      }
    } catch (e: unknown) {
      if (!opts?.silent) {
        const msg = e instanceof Error ? e.message : 'Failed to load dashboard';
        setError(msg);
        try {
          setData(await fetchDashboardLegacyParallel());
        } catch {
          setData(defaultData);
        }
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchAll({ silent: true });
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchAll, pollIntervalMs]);

  return { data, loading, error, refetch: () => void fetchAll() };
}
