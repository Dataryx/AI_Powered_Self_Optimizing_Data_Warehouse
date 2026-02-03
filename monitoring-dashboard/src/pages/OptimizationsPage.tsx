/**
 * Optimization Dashboard Page
 * Modern, enterprise-grade ML-powered optimization recommendations
 * Design: Clean, minimal, professional - advisory-only, human-in-the-loop
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import { Refresh, FiberManualRecord } from '@mui/icons-material';
import { IndexRecommendations } from '../components/optimization/IndexRecommendations';
import { PartitionRecommendations } from '../components/optimization/PartitionRecommendations';
import { QueryPerformance } from '../components/optimization/QueryPerformance';
import { OptimizationHistory } from '../components/optimization/OptimizationHistory';
import { ApiStatusChecker } from '../components/common/ApiStatusChecker';

export const OptimizationsPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

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

      <Box sx={{ maxWidth: '1600px', mx: 'auto', p: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
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
                      color: isOnline ? '#10b981' : '#ef4444',
                      animation: isOnline ? 'pulse 2s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                      },
                    }}
                  />
                }
                label={isOnline ? 'Live' : 'Offline'}
                size="small"
                sx={{
                  backgroundColor: isOnline ? '#10b98115' : '#ef444415',
                  color: isOnline ? '#10b981' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: '24px',
                  border: `1px solid ${isOnline ? '#10b98140' : '#ef444440'}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: '#64748b', fontSize: '0.75rem' }}
              >
                Last updated: {formatTime(lastUpdate)}
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

        {/* Section 1 & 2: Index and Partition Recommendations - Side by Side */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
            }}
          >
            <IndexRecommendations refreshKey={refreshKey} />
            <PartitionRecommendations refreshKey={refreshKey} />
          </Box>
        </Box>

        {/* Section 3: Query Performance Analysis - Full Width */}
        <Box sx={{ mb: 4 }}>
          <QueryPerformance refreshKey={refreshKey} />
        </Box>

        {/* Section 4: Optimization History - Full Width */}
        <Box sx={{ mb: 4 }}>
          <OptimizationHistory refreshKey={refreshKey} />
        </Box>
      </Box>
    </Box>
  );
};
