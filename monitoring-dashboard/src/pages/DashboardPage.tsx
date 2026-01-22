/**
 * Dashboard Page
 * Main dashboard view with real data
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, CircularProgress, Alert, Paper } from '@mui/material';
import { apiService } from '../services/api';
import { StatCard } from '../components/dashboard/StatCard';
import { SalesChart } from '../components/dashboard/SalesChart';
import { TopProductsChart } from '../components/dashboard/TopProductsChart';
import { WarehouseOverview } from '../components/dashboard/WarehouseOverview';
import {
  ShoppingCart,
  AttachMoney,
  People,
  TrendingUp,
  Inventory,
  Assessment,
} from '@mui/icons-material';

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseSummary, setWarehouseSummary] = useState<any>(null);
  const [salesStats, setSalesStats] = useState<any>(null);
  const [customerStats, setCustomerStats] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        if (isMounted) {
          setLoading(true);
        }
        
        const [summary, sales, customers] = await Promise.all([
          apiService.getWarehouseSummary(),
          apiService.getSalesStats(),
          apiService.getCustomerStats(),
        ]);
        
        if (isMounted) {
          setWarehouseSummary(summary);
          setSalesStats(sales);
          setCustomerStats(customers);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load dashboard data');
          setLoading(false);
          console.error('Dashboard error:', err);
        }
      }
    };

    // Load data once on mount - no auto-refresh
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Default/empty data structure
  const defaultSummary = {
    bronze: { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
    silver: { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
    gold: { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
  };

  const displaySummary = warehouseSummary?.warehouse_summary || defaultSummary;
  const displaySalesStats = salesStats || {
    total_sales: { count: 0, revenue: 0, avg_sale: 0 },
    daily_sales: [],
    top_products: [],
  };
  const displayCustomerStats = customerStats || { total_customers: 0 };

  const totalRows =
    (displaySummary.bronze?.estimated_rows || 0) +
    (displaySummary.silver?.estimated_rows || 0) +
    (displaySummary.gold?.estimated_rows || 0);

  const totalTables =
    (displaySummary.bronze?.table_count || 0) +
    (displaySummary.silver?.table_count || 0) +
    (displaySummary.gold?.table_count || 0);

  return (
    <Box
      sx={{
        p: 3,
        minHeight: '100vh',
        position: 'relative',
        background: 'transparent',
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 800,
            mb: 0.5,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.75rem', md: '2rem' },
          }}
        >
          Data Warehouse Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.875rem' }}>
          Real-time insights and analytics for your data warehouse
        </Typography>
      </Box>

      {/* Warehouse Overview - Always show */}
      <Box sx={{ mb: 3 }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            API unavailable. Showing placeholder data. {error}
          </Alert>
        )}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
            <CircularProgress size={40} />
          </Box>
        )}
        <WarehouseOverview summary={displaySummary} />
      </Box>

      {/* Key Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Records"
            value={totalRows.toLocaleString()}
            icon={<Assessment sx={{ fontSize: 24 }} />}
            color="#1976d2"
            subtitle="Across all layers"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Tables"
            value={totalTables}
            icon={<Inventory sx={{ fontSize: 32 }} />}
            color="#dc004e"
            subtitle="Bronze, Silver, Gold"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Sales"
            value={displaySalesStats.total_sales?.count?.toLocaleString() || '0'}
            icon={<ShoppingCart sx={{ fontSize: 32 }} />}
            color="#4caf50"
            subtitle={error ? 'API unavailable' : 'Sales transactions'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={`$${(displaySalesStats.total_sales?.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<AttachMoney sx={{ fontSize: 32 }} />}
            color="#ff9800"
            subtitle={error ? 'API unavailable' : 'From all sales'}
          />
        </Grid>
      </Grid>

      {/* Sales Statistics - Always show */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <StatCard
            title="Average Sale Value"
            value={`$${(displaySalesStats.total_sales?.avg_sale || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            icon={<TrendingUp sx={{ fontSize: 32 }} />}
            color="#9c27b0"
            subtitle={error ? 'API unavailable' : 'Per transaction'}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StatCard
            title="Total Customers"
            value={(displayCustomerStats.total_customers || 0).toLocaleString()}
            icon={<People sx={{ fontSize: 32 }} />}
            color="#0288d1"
            subtitle={error ? 'API unavailable' : 'Registered customers'}
          />
        </Grid>
      </Grid>

      {/* Charts - Always show */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <SalesChart data={displaySalesStats.daily_sales || []} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <TopProductsChart data={displaySalesStats.top_products || []} />
        </Grid>
      </Grid>

      {/* Additional Info */}
      <Paper
        sx={{
          p: 2,
          mt: 3,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          boxShadow: '0 10px 30px -10px rgba(102, 126, 234, 0.4)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            filter: 'blur(40px)',
          },
        }}
      >
        <Typography variant="body1" gutterBottom sx={{ fontWeight: 700, position: 'relative', zIndex: 1, fontSize: '0.95rem' }}>
          Database Information
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, mt: 1.5, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.25, fontSize: '0.7rem' }}>
              Database
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {warehouseSummary?.database || (error ? 'API unavailable' : 'N/A')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.25, fontSize: '0.7rem' }}>
              Last Updated
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {new Date().toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
