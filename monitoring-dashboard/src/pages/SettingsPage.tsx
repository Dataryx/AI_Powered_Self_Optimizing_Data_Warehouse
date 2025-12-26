/**
 * Settings Page
 * Page for application settings and configuration.
 */

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export const SettingsPage: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Settings
        </Typography>
        <Typography color="text.secondary">
          Settings page coming soon
        </Typography>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
