/**
 * Dashboard Page
 * Main dashboard with overview panels and real-time visualizations.
 */

import React from 'react';
import { Grid, Paper, Box } from '@mui/material';
import { OverviewPanel } from '../components/dashboard/OverviewPanel';
import { QueryPerformanceChart } from '../components/dashboard/QueryPerformanceChart';
import { ResourceUtilizationGraph } from '../components/dashboard/ResourceUtilizationGraph';
import { WorkloadPatternViz } from '../components/dashboard/WorkloadPatternViz';
import { OptimizationTimeline } from '../components/dashboard/OptimizationTimeline';

export const DashboardPage: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        {/* Overview Panel */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <OverviewPanel />
          </Paper>
        </Grid>

        {/* Query Performance Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <QueryPerformanceChart />
          </Paper>
        </Grid>

        {/* Resource Utilization */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <ResourceUtilizationGraph />
          </Paper>
        </Grid>

        {/* Workload Pattern Visualization */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <WorkloadPatternViz />
          </Paper>
        </Grid>

        {/* Optimization Timeline */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <OptimizationTimeline />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;


