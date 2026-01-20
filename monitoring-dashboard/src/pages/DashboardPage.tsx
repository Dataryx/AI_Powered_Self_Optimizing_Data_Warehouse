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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const totalRows =
    (warehouseSummary?.warehouse_summary?.bronze?.estimated_rows || 0) +
    (warehouseSummary?.warehouse_summary?.silver?.estimated_rows || 0) +
    (warehouseSummary?.warehouse_summary?.gold?.estimated_rows || 0);

  const totalTables =
    (warehouseSummary?.warehouse_summary?.bronze?.table_count || 0) +
    (warehouseSummary?.warehouse_summary?.silver?.table_count || 0) +
    (warehouseSummary?.warehouse_summary?.gold?.table_count || 0);

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

      {/* Warehouse Overview */}
      {warehouseSummary && (
        <Box sx={{ mb: 3 }}>
          <WarehouseOverview summary={warehouseSummary.warehouse_summary} />
        </Box>
      )}

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
            value={salesStats?.total_sales?.count?.toLocaleString() || '0'}
            icon={<ShoppingCart sx={{ fontSize: 32 }} />}
            color="#4caf50"
            subtitle="Sales transactions"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={`$${(salesStats?.total_sales?.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<AttachMoney sx={{ fontSize: 32 }} />}
            color="#ff9800"
            subtitle="From all sales"
          />
        </Grid>
      </Grid>

      {/* Sales Statistics */}
      {salesStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <StatCard
              title="Average Sale Value"
              value={`$${(salesStats.total_sales?.avg_sale || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              icon={<TrendingUp sx={{ fontSize: 32 }} />}
              color="#9c27b0"
              subtitle="Per transaction"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <StatCard
              title="Total Customers"
              value={(customerStats?.total_customers || 0).toLocaleString()}
              icon={<People sx={{ fontSize: 32 }} />}
              color="#0288d1"
              subtitle="Registered customers"
            />
          </Grid>
        </Grid>
      )}

      {/* Charts */}
      {salesStats && (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <SalesChart data={salesStats.daily_sales || []} />
          </Grid>
          <Grid item xs={12} lg={4}>
            <TopProductsChart data={salesStats.top_products || []} />
          </Grid>
        </Grid>
      )}

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
              {warehouseSummary?.database || 'N/A'}
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
