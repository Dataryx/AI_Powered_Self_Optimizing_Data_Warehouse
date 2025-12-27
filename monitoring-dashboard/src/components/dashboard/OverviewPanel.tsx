import React from 'react';
import { Grid } from '@mui/material';
import {
  QueryStats as QueryStatsIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { MetricCard } from './MetricCard';

export const OverviewPanel: React.FC = () => {
  const metrics = [
    {
      title: 'Total Queries',
      value: '15.2K',
      change: 12.5,
      icon: <QueryStatsIcon sx={{ fontSize: 32, color: 'white' }} />,
      gradient: 'rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.8) 100%',
    },
    {
      title: 'Avg Response Time',
      value: '145ms',
      change: -8.3,
      icon: <SpeedIcon sx={{ fontSize: 32, color: 'white' }} />,
      gradient: 'rgba(16, 185, 129, 0.8) 0%, rgba(52, 211, 153, 0.8) 100%',
    },
    {
      title: 'Optimization Savings',
      value: '23.5%',
      change: 3.2,
      icon: <TrendingUpIcon sx={{ fontSize: 32, color: 'white' }} />,
      gradient: 'rgba(236, 72, 153, 0.8) 0%, rgba(244, 114, 182, 0.8) 100%',
    },
    {
      title: 'Active Alerts',
      value: '2',
      icon: <WarningIcon sx={{ fontSize: 32, color: 'white' }} />,
      gradient: 'rgba(245, 158, 11, 0.8) 0%, rgba(251, 191, 36, 0.8) 100%',
    },
  ];

  return (
    <Grid container spacing={3}>
      {metrics.map((metric, index) => (
        <Grid item xs={12} sm={6} lg={3} key={index}>
          <MetricCard {...metric} />
        </Grid>
      ))}
    </Grid>
  );
};

