/**
 * Alerts Page
 * Page for viewing and managing alerts.
 */

import React from 'react';
import { Box, Grid, Paper } from '@mui/material';
import { AnomalyAlerts } from '../components/alerts/AnomalyAlerts';
import { SystemHealthAlerts } from '../components/alerts/SystemHealthAlerts';

export const AlertsPage: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <AnomalyAlerts />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <SystemHealthAlerts />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AlertsPage;
