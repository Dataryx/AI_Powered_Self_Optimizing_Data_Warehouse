/**
 * Analytics Page
 * Page for viewing analytics and insights.
 */

import React from 'react';
import { Box, Grid, Paper } from '@mui/material';
import { QueryAnalytics } from '../components/analytics/QueryAnalytics';
import { UsageAnalytics } from '../components/analytics/UsageAnalytics';
import { CostBenefitAnalysis } from '../components/analytics/CostBenefitAnalysis';

export const AnalyticsPage: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <QueryAnalytics />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <UsageAnalytics />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <CostBenefitAnalysis />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
