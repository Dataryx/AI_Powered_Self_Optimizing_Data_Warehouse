import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const AnalyticsPage: React.FC = () => {
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
        Analytics
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: '#ffffff' }}>
            Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Analytics data and insights will be displayed here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AnalyticsPage;

