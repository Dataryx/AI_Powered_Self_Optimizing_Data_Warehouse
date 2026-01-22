/**
 * Alerts & Incidents Dashboard Page
 * Enhanced with real-time updates and unique UI design
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton, Chip, CircularProgress } from '@mui/material';
import { Refresh, FiberManualRecord } from '@mui/icons-material';
import { ActiveAlerts } from '../components/alerts/ActiveAlerts';
import { AnomalyDetection } from '../components/alerts/AnomalyDetection';
import { IncidentTracker } from '../components/alerts/IncidentTracker';

export const AlertsIncidentsPage: React.FC = () => {
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
        position: 'relative',
        background: 'transparent',
      }}
    >
      {/* Header Section */}
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
              fontWeight: 800,
              mb: 0.5,
              background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 50%, #3b82f6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.75rem', md: '2rem' },
            }}
          >
            Alerts & Incidents Dashboard
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary', 
              fontWeight: 500, 
              fontSize: '0.875rem' 
            }}
          >
            Real-time alerts, anomaly detection, and incident tracking
          </Typography>
        </Box>

        {/* Status & Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
              backgroundColor: isLive ? '#10b98115' : '#ef444415',
              color: isLive ? '#10b981' : '#ef4444',
              fontWeight: 600,
              border: `1px solid ${isLive ? '#10b98140' : '#ef444440'}`,
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {isLive ? `Updated: ${formatTime(lastUpdate)}` : 'API unavailable'}
          </Typography>
          <IconButton
            onClick={handleRefresh}
            disabled={isRefreshing}
            sx={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              '&:hover': {
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s',
            }}
          >
            {isRefreshing ? (
              <CircularProgress size={20} sx={{ color: '#ef4444' }} />
            ) : (
              <Refresh />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* Alerts and Anomalies - Side by Side */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          <ActiveAlerts refreshKey={refreshKey} />
          <AnomalyDetection refreshKey={refreshKey} />
        </Box>
      </Box>

      {/* Incidents - Full Width */}
      <Box sx={{ mb: 3 }}>
        <IncidentTracker refreshKey={refreshKey} />
      </Box>
    </Box>
  );
};

