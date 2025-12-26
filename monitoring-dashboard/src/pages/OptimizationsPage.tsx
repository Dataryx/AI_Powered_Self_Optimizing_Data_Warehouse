/**
 * Optimizations Page
 * Page for viewing and managing optimization recommendations.
 */

import React from 'react';
import { Box, Grid, Paper } from '@mui/material';
import { IndexRecommendations } from '../components/optimization/IndexRecommendations';
import { PartitionRecommendations } from '../components/optimization/PartitionRecommendations';
import { CacheAnalytics } from '../components/optimization/CacheAnalytics';
import { OptimizationDecisionLog } from '../components/optimization/OptimizationDecisionLog';

export const OptimizationsPage: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <IndexRecommendations />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <PartitionRecommendations />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <CacheAnalytics />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <OptimizationDecisionLog />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OptimizationsPage;
