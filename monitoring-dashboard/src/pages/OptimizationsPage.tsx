/**
 * Optimization Dashboard Page
 * Modern, enterprise-grade ML-powered optimization recommendations
 * Design: Clean, minimal, professional - advisory-only, human-in-the-loop
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Typography, IconButton, Chip, Paper, Divider, Grid } from '@mui/material';
import { Refresh, FiberManualRecord } from '@mui/icons-material';
import { IndexRecommendations } from '../components/optimization/IndexRecommendations';
import { PartitionRecommendations } from '../components/optimization/PartitionRecommendations';
import { QueryPerformance } from '../components/optimization/QueryPerformance';
import { OptimizationHistory } from '../components/optimization/OptimizationHistory';
import { ApiStatusChecker } from '../components/common/ApiStatusChecker';
import { useOptimizationRealtimeWebSocket } from '../hooks/useOptimizationRealtimeWebSocket';

const REC_LIMIT = 100;

export const OptimizationsPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [timeRange, setTimeRange] = useState('7');
  const performanceDays = parseInt(timeRange, 10) || 7;

  const opt = useOptimizationRealtimeWebSocket({
    performanceDays,
    performanceLimit: REC_LIMIT,
    recommendationsLimit: REC_LIMIT,
    historyLimit: REC_LIMIT,
    wsIntervalMs: 2000,
    fallbackIntervalMs: 2000,
    refreshKey,
  });

  /** First HTTP/WS snapshot not yet applied (all panels share one payload). */
  const dataLoading = opt.indexRecommendations === null && !opt.error;

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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const displayUpdate = opt.lastUpdate ?? new Date();
  const streamStatus = !isOnline
    ? { label: 'Offline', color: '#ef4444', bg: '#ef444415', border: '#ef444440' }
    : opt.wsConnected
      ? { label: 'Live', color: '#10b981', bg: '#10b98115', border: '#10b98140' }
      : opt.usingFallback
        ? { label: 'Polling', color: '#d97706', bg: '#fef3c7', border: '#f59e0b40' }
        : { label: 'Connecting…', color: '#6366f1', bg: '#e0e7ff', border: '#6366f140' };

  const kpis = useMemo(() => {
    const indexCount = Array.isArray(opt.indexRecommendations)
      ? opt.indexRecommendations.length
      : 0;
    const partitionCount = Array.isArray(opt.partitionRecommendations)
      ? opt.partitionRecommendations.length
      : 0;
    const totalRecs = indexCount + partitionCount;
    const queryCount = Array.isArray(opt.performanceMetrics)
      ? opt.performanceMetrics.length
      : 0;
    const historyCount = Array.isArray(opt.history) ? opt.history.length : 0;
    return { indexCount, partitionCount, totalRecs, queryCount, historyCount };
  }, [opt.indexRecommendations, opt.partitionRecommendations, opt.performanceMetrics, opt.history]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#fafbfc',
        fontFamily: '"Inter", "SF Pro Display", "Roboto", sans-serif',
      }}
    >
      {/* API Status Checker */}
      <ApiStatusChecker />

      <Box sx={{ maxWidth: '1600px', mx: 'auto', p: 4, pt: 3 }}>
        {/* Page Header */}
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 3,
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: '1.875rem',
                  letterSpacing: '-0.02em',
                  mb: 0.5,
                }}
              >
                Optimization Dashboard
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#64748b',
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                }}
              >
                ML-powered optimization recommendations, query performance analysis, and optimization history
              </Typography>
            </Box>

            {/* Status Indicators */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip
                label="Optimization policy v1.0"
                size="small"
                sx={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: '24px',
                  border: '1px solid #e2e8f0',
                }}
              />
              <Chip
                icon={
                  <FiberManualRecord
                    sx={{
                      fontSize: '8px !important',
                      color: streamStatus.color,
                      animation:
                        isOnline && opt.wsConnected ? 'pulse 2s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                      },
                    }}
                  />
                }
                label={streamStatus.label}
                size="small"
                sx={{
                  backgroundColor: streamStatus.bg,
                  color: streamStatus.color,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: '24px',
                  border: `1px solid ${streamStatus.border}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: '#64748b', fontSize: '0.75rem' }}
              >
                Last updated: {formatTime(displayUpdate)}
              </Typography>
              <IconButton
                onClick={handleRefresh}
                disabled={isRefreshing || !isOnline}
                size="small"
                sx={{
                  color: '#6366f1',
                  '&:hover': { backgroundColor: '#f1f5f9' },
                  '&:disabled': { opacity: 0.4 },
                }}
              >
                <Refresh
                  sx={{
                    fontSize: 18,
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* KPI strip */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Recommendations
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: '1.5rem',
                  lineHeight: 1.1,
                }}
              >
                {kpis.totalRecs.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {kpis.indexCount} index · {kpis.partitionCount} partition
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Active query shapes
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: '1.5rem',
                  lineHeight: 1.1,
                }}
              >
                {kpis.queryCount.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Ranked by total execution time in selected window.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Optimization history
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: '1.5rem',
                  lineHeight: 1.1,
                }}
              >
                {kpis.historyCount.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Entries recorded in the optimization catalog.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Section 1 & 2: Index and Partition Recommendations - Side by Side */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
            }}
          >
            <IndexRecommendations
              recommendations={opt.indexRecommendations}
              error={opt.error}
              loading={dataLoading}
            />
            <PartitionRecommendations
              recommendations={opt.partitionRecommendations}
              error={opt.error}
              loading={dataLoading}
            />
          </Box>
        </Box>

        {/* Section 3: Query Performance Analysis - Full Width */}
        <Box sx={{ mb: 4 }}>
          <QueryPerformance
            performanceMetrics={opt.performanceMetrics}
            error={opt.error}
            loading={dataLoading}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </Box>

        {/* Section 4: Optimization History - Full Width */}
        <Box sx={{ mb: 4 }}>
          <OptimizationHistory
            history={opt.history}
            error={opt.error}
            loading={dataLoading}
          />
        </Box>
      </Box>
    </Box>
  );
};
