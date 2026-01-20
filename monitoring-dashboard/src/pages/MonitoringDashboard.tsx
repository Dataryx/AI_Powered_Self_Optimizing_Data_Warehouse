/**
 * Monitoring Dashboard Page
 * ETL monitoring with job status, pipeline DAG, freshness, errors, throughput, and data quality
 * Real-time updates with synchronized data fetching
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, IconButton, Chip, Tooltip } from '@mui/material';
import { Refresh, Wifi, WifiOff, AccessTime } from '@mui/icons-material';
import { ETLJobStatus } from '../components/monitoring/ETLJobStatus';
import { PipelineDAG } from '../components/monitoring/PipelineDAG';
import { DataFreshness } from '../components/monitoring/DataFreshness';
import { ErrorRetryTracker } from '../components/monitoring/ErrorRetryTracker';
import { ThroughputMetrics } from '../components/monitoring/ThroughputMetrics';
import { DataQualityMetrics } from '../components/monitoring/DataQualityMetrics';
import { ApiStatusChecker } from '../components/common/ApiStatusChecker';

export const MonitoringDashboard: React.FC = () => {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Track when components actually fetch data
  useEffect(() => {
    // Initial update
    setLastUpdate(new Date());
  }, [refreshKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    
    // Force refresh all components
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdate(new Date());
    }, 1000);
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Box
      sx={{
        p: 3,
        minHeight: '100vh',
        position: 'relative',
        background: 'transparent',
      }}
    >
      {/* API Status Checker */}
      <ApiStatusChecker />

      {/* Header with Real-time Status */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
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
              ETL Monitoring Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.875rem' }}>
              Real-time ETL pipeline monitoring, data quality, and performance metrics
            </Typography>
          </Box>
          
          {/* Real-time Status Indicators */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title={isOnline ? 'Connected' : 'Offline'}>
              <Chip
                icon={isOnline ? <Wifi sx={{ fontSize: 16 }} /> : <WifiOff sx={{ fontSize: 16 }} />}
                label={isOnline ? 'Live' : 'Offline'}
                size="small"
                sx={{
                  backgroundColor: isOnline ? '#10b98120' : '#ef444420',
                  color: isOnline ? '#10b981' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
            </Tooltip>
            
            <Tooltip title={`Last updated: ${lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}`}>
              <Chip
                icon={<AccessTime sx={{ fontSize: 16 }} />}
                label={formatTimeAgo(lastUpdate)}
                size="small"
                sx={{
                  backgroundColor: '#6366f120',
                  color: '#6366f1',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
            </Tooltip>
            
            <Tooltip title="Refresh all data">
              <IconButton
                onClick={handleRefresh}
                disabled={isRefreshing || !isOnline}
                sx={{
                  color: '#6366f1',
                  backgroundColor: '#6366f110',
                  '&:hover': {
                    backgroundColor: '#6366f120',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Pipeline DAG */}
      <Box sx={{ mb: 3 }}>
        <PipelineDAG key={`dag-${refreshKey}`} />
      </Box>

      {/* ETL Job Status and Data Freshness */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <ETLJobStatus key={`jobs-${refreshKey}`} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <DataFreshness key={`freshness-${refreshKey}`} />
        </Grid>
      </Grid>

      {/* Throughput Metrics */}
      <Box sx={{ mb: 3 }}>
        <ThroughputMetrics key={`throughput-${refreshKey}`} />
      </Box>

      {/* Error Tracker and Data Quality */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <ErrorRetryTracker key={`errors-${refreshKey}`} />
        </Grid>
        <Grid item xs={12} lg={6}>
          <DataQualityMetrics key={`quality-${refreshKey}`} />
        </Grid>
      </Grid>
    </Box>
  );
};

