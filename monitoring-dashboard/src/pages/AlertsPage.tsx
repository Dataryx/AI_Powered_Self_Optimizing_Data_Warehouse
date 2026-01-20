/**
 * Alerts & Incidents Dashboard Page
 * Displays active alerts, history, anomalies, and incidents
 */

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { ActiveAlertsList } from '../components/alerts/ActiveAlertsList';

export const AlertsPage: React.FC = () => {
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
            background: 'linear-gradient(135deg, #ef4444 0%, #f87171 50%, #f59e0b 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.75rem', md: '2rem' },
          }}
        >
          Alerts & Incidents Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.875rem' }}>
          Active alerts, history, anomalies, and incident tracking
        </Typography>
      </Box>

      {/* Active Alerts */}
      <Box sx={{ mb: 3 }}>
        <ActiveAlertsList />
      </Box>
    </Box>
  );
};



