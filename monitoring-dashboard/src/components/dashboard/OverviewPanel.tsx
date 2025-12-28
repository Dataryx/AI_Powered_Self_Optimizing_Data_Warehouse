import React, { useState, useEffect } from 'react';
import { Grid, CircularProgress, Box } from '@mui/material';
import {
  QueryStats as QueryStatsIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { MetricCard } from './MetricCard';
import { getDashboardMetrics } from '../../services/api';

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

export const OverviewPanel: React.FC = () => {
  const [metrics, setMetrics] = useState({
    queriesToday: 0,
    avgResponseTime: 0,
    optimizationSavings: 0,
    activeAlerts: 0,
    queriesChange: 0,
    responseTimeChange: 0,
    savingsChange: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await getDashboardMetrics();
        setMetrics(data);
      } catch (error) {
        console.error('Error loading dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={40} sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
      </Box>
    );
  }

  const metricCards = [
    {
      title: 'Total Queries',
      value: formatNumber(metrics.queriesToday),
      change: metrics.queriesChange,
      icon: <QueryStatsIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
    {
      title: 'Avg Response Time',
      value: `${Math.round(metrics.avgResponseTime)}ms`,
      change: metrics.responseTimeChange,
      icon: <SpeedIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
    {
      title: 'Optimization Savings',
      value: `${metrics.optimizationSavings.toFixed(1)}%`,
      change: metrics.savingsChange,
      icon: <TrendingUpIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
    {
      title: 'Active Alerts',
      value: metrics.activeAlerts.toString(),
      icon: <WarningIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
  ];

  return (
    <Grid container spacing={3}>
      {metricCards.map((metric, index) => (
        <Grid item xs={12} sm={6} lg={3} key={index}>
          <MetricCard {...metric} />
        </Grid>
      ))}
    </Grid>
  );
};

