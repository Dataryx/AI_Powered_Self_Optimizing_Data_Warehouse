import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const AlertsPage: React.FC = () => {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontWeight: 800,
          mb: 4,
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}
      >
        Alerts
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: '#ffffff' }}>
            System Alerts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Active alerts and notifications will be displayed here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AlertsPage;

