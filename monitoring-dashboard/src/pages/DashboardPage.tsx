import React from 'react';
import { Grid, Box, Typography } from '@mui/material';
import { OverviewPanel } from '../components/dashboard/OverviewPanel';
import { QueryPerformanceChart } from '../components/dashboard/QueryPerformanceChart';
import { ResourceUtilization } from '../components/dashboard/ResourceUtilization';

const DashboardPage: React.FC = () => {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontWeight: 800,
          mb: 4,
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}
      >
        Dashboard Overview
      </Typography>

      {/* Metrics Cards Row */}
      <Box sx={{ mb: 4 }}>
        <OverviewPanel />
      </Box>

      {/* Charts Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <QueryPerformanceChart />
        </Grid>
        <Grid item xs={12} lg={4}>
          <ResourceUtilization />
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;

