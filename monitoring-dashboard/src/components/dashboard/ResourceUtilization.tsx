import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Grid, CircularProgress } from '@mui/material';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  NetworkCheck as NetworkIcon,
} from '@mui/icons-material';
import { getResourceUtilization, ResourceUtilization as ResourceUtilizationType } from '../../services/api';

export const ResourceUtilization: React.FC = () => {
  const [resources, setResources] = useState([
    { name: 'CPU', value: 0, icon: <SpeedIcon />, color: '#64748b' },
    { name: 'Memory', value: 0, icon: <MemoryIcon />, color: '#94a3b8' },
    { name: 'Disk', value: 0, icon: <StorageIcon />, color: '#cbd5e1' },
    { name: 'Network', value: 0, icon: <NetworkIcon />, color: '#e2e8f0' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getResourceUtilization();
        setResources([
          { name: 'CPU', value: data.cpu, icon: <SpeedIcon />, color: '#64748b' },
          { name: 'Memory', value: data.memory, icon: <MemoryIcon />, color: '#94a3b8' },
          { name: 'Disk', value: data.disk, icon: <StorageIcon />, color: '#cbd5e1' },
          { name: 'Network', value: data.network, icon: <NetworkIcon />, color: '#e2e8f0' },
        ]);
      } catch (error) {
        console.error('Error loading resource utilization:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  if (loading) {
    return (
      <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pb: 3 }}>
          <CircularProgress size={40} sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
        </CardContent>
      </Card>
    );
  }

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
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {resource.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        mb: 0.5, 
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontWeight: 400,
                        fontSize: '0.875rem',
                      }}
                    >
                      {resource.name}
                    </Typography>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontWeight: 600, 
                        color: 'rgba(255, 255, 255, 0.95)',
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
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    '& .MuiLinearProgress-bar': {
                      background: resource.color,
                      borderRadius: 4,
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

