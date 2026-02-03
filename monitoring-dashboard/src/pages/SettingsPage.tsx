/**
 * Monitoring System Settings Page
 * Enterprise-grade settings configuration interface
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton, Chip, CircularProgress } from '@mui/material';
import { Refresh, FiberManualRecord } from '@mui/icons-material';
import { AlertSettings } from '../components/settings/AlertSettings';
import { MonitoringSettings } from '../components/settings/MonitoringSettings';
import { SystemSettings } from '../components/settings/SystemSettings';

export const SettingsPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);

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
      second: '2-digit' 
    });
  };

  return (
    <Box
      sx={{
        p: 3,
        minHeight: '100vh',
        background: 'transparent',
      }}
    >
      {/* Page Header */}
      <Box 
        sx={{ 
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 600,
              mb: 0.5,
              color: 'text.primary',
              letterSpacing: '-0.01em',
              fontSize: { xs: '1.5rem', md: '1.75rem' },
            }}
          >
            Monitoring System Settings
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary', 
              fontWeight: 400, 
              fontSize: '0.875rem' 
            }}
          >
            Configure alerts, monitoring intervals, and system preferences
          </Typography>
        </Box>

        {/* Status & Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={
              <FiberManualRecord 
                sx={{ 
                  fontSize: '8px !important',
                  color: isLive ? '#10b981' : '#ef4444',
                  animation: isLive ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }} 
              />
            }
            label={isLive ? 'Live' : 'Offline'}
            size="small"
            sx={{
              backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isLive ? '#10b981' : '#ef4444',
              fontWeight: 500,
              border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            Last updated: {formatTime(lastUpdate)}
          </Typography>
          <IconButton
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s',
            }}
          >
            {isRefreshing ? (
              <CircularProgress size={20} />
            ) : (
              <Refresh />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* Settings Sections */}
      {/* Row 1: Alert Settings and Monitoring Settings */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          <AlertSettings refreshKey={refreshKey} />
          <MonitoringSettings refreshKey={refreshKey} />
        </Box>
      </Box>

      {/* Row 2: System Settings - Full Width */}
      <Box>
        <SystemSettings refreshKey={refreshKey} />
      </Box>
    </Box>
  );
};
