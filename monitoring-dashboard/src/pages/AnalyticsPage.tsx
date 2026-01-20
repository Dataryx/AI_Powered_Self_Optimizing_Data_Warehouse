/**
 * Analytics Page
 */

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const AnalyticsPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1">
          Analytics and insights will be displayed here.
        </Typography>
      </Paper>
    </Box>
  );
};



