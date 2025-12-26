/**
 * Overview Panel Component
 * Key metrics at a glance.
 */

import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import {
  TrendingUp,
  Speed,
  Assessment,
  Warning,
} from '@mui/icons-material';
import apiService from '../../services/api';
import { formatNumber, formatDuration } from '../../utils/formatters';

interface OverviewMetrics {
  queriesToday: number;
  avgResponseTime: number;
  optimizationSavings: number;
  activeAlerts: number;
}

export const OverviewPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    queriesToday: 0,
    avgResponseTime: 0,
    optimizationSavings: 0,
    activeAlerts: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [realtimeMetrics, alerts] = await Promise.all([
          apiService.getRealtimeMetrics(),
          apiService.getActiveAlerts(),
        ]);

        setMetrics({
          queriesToday: realtimeMetrics.query_count || 0,
          avgResponseTime: realtimeMetrics.avg_query_time_ms || 0,
          optimizationSavings: 0, // TODO: Calculate from optimization metrics
          activeAlerts: alerts.length || 0,
        });
      } catch (error) {
        console.error('Error fetching overview metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const metricCards = [
    {
      title: 'Queries Today',
      value: formatNumber(metrics.queriesToday),
      icon: <Assessment />,
      color: '#1976d2',
    },
    {
      title: 'Avg Response Time',
      value: formatDuration(metrics.avgResponseTime),
      icon: <Speed />,
      color: '#2e7d32',
    },
    {
      title: 'Optimization Savings',
      value: `${metrics.optimizationSavings.toFixed(1)}%`,
      icon: <TrendingUp />,
      color: '#ed6c02',
    },
    {
      title: 'Active Alerts',
      value: metrics.activeAlerts.toString(),
      icon: <Warning />,
      color: metrics.activeAlerts > 0 ? '#d32f2f' : '#757575',
    },
  ];

  return (
    <Grid container spacing={3}>
      {metricCards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Box
                  sx={{
                    backgroundColor: `${card.color}20`,
                    color: card.color,
                    borderRadius: '50%',
                    p: 1,
                    mr: 2,
                  }}
                >
                  {card.icon}
                </Box>
                <Typography variant="h6" component="div">
                  {card.title}
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {card.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default OverviewPanel;


