/**
 * Storage & Resource Dashboard Page
 * Displays storage utilization, growth trends, compression, cache, resources, and cost
 */

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { StorageUtilization } from '../components/storage/StorageUtilization';
import { GrowthTrends } from '../components/storage/GrowthTrends';
import { CompressionStats } from '../components/storage/CompressionStats';
import { CachePerformance } from '../components/storage/CachePerformance';
import { ResourceAllocation } from '../components/storage/ResourceAllocation';
import { CostTracker } from '../components/storage/CostTracker';

export const StorageDashboard: React.FC = () => {
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
          Storage & Resource Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.875rem' }}>
          Storage utilization, growth trends, compression, cache performance, and cost tracking
        </Typography>
      </Box>

      {/* Storage Utilization */}
      <Box sx={{ mb: 3 }}>
        <StorageUtilization />
      </Box>

      {/* Growth Trends */}
      <Box sx={{ mb: 3 }}>
        <GrowthTrends />
      </Box>

      {/* Compression and Cache */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <CompressionStats />
        </Grid>
        <Grid item xs={12} lg={6}>
          <CachePerformance />
        </Grid>
      </Grid>

      {/* Resources and Cost */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <ResourceAllocation />
        </Grid>
        <Grid item xs={12} lg={6}>
          <CostTracker />
        </Grid>
      </Grid>
    </Box>
  );
};

