import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Grid } from '@mui/material';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  NetworkCheck as NetworkIcon,
} from '@mui/icons-material';

const resources = [
  { name: 'CPU', value: 45.2, icon: <SpeedIcon />, color: '#6366f1' },
  { name: 'Memory', value: 67.8, icon: <MemoryIcon />, color: '#ec4899' },
  { name: 'Disk', value: 34.5, icon: <StorageIcon />, color: '#10b981' },
  { name: 'Network', value: 23.1, icon: <NetworkIcon />, color: '#f59e0b' },
];

export const ResourceUtilization: React.FC = () => {
  return (
    <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: 3 }}>
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontWeight: 700, 
            mb: 3, 
            color: '#ffffff',
            fontSize: '1.25rem',
          }}
        >
          Resource Utilization
        </Typography>
        <Grid container spacing={2.5} sx={{ flex: 1 }}>
          {resources.map((resource, index) => (
            <Grid item xs={12} key={index}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderColor: `${resource.color}40`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${resource.color}20 0%, ${resource.color}10 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: resource.color,
                      border: `1px solid ${resource.color}30`,
                    }}
                  >
                    {resource.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        mb: 0.5, 
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                      }}
                    >
                      {resource.name}
                    </Typography>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontWeight: 700, 
                        color: resource.color,
                        fontSize: '1.5rem',
                      }}
                    >
                      {resource.value.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={resource.value}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    '& .MuiLinearProgress-bar': {
                      background: `linear-gradient(90deg, ${resource.color} 0%, ${resource.color}CC 100%)`,
                      borderRadius: 5,
                      boxShadow: `0 0 12px ${resource.color}50`,
                    },
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

