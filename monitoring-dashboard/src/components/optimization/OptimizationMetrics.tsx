import React from 'react';
import { Grid, Card, CardContent, Box, Typography } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

interface OptimizationMetricsProps {
  totalRecommendations: number;
  appliedCount: number;
  pendingCount: number;
  rejectedCount: number;
  avgImprovement: number;
  totalTimeSaved: number;
}

export const OptimizationMetrics: React.FC<OptimizationMetricsProps> = ({
  totalRecommendations,
  appliedCount,
  pendingCount,
  rejectedCount,
  avgImprovement,
  totalTimeSaved,
}) => {
  const metrics = [
    {
      title: 'Total Recommendations',
      value: totalRecommendations,
      icon: <TrendingUpIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
    {
      title: 'Applied',
      value: appliedCount,
      icon: <CheckCircleIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
    {
      title: 'Pending',
      value: pendingCount,
      icon: <PendingIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
    {
      title: 'Rejected',
      value: rejectedCount,
      icon: <CancelIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.8)' }} />,
    },
  ];

  return (
    <>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metrics.map((metric, index) => (
          <Grid item xs={12} sm={6} lg={3} key={index}>
            <Card
              sx={{
                height: '100%',
                width: '100%',
                background: 'rgba(17, 17, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1.5,
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {metric.icon}
                  </Box>
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    color: '#ffffff',
                    letterSpacing: '-0.01em',
                    fontSize: '1.75rem',
                  }}
                >
                  {metric.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 400, fontSize: '0.875rem' }}>
                  {metric.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: 'rgba(17, 17, 26, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#ffffff', fontSize: '1.25rem' }}>
                Average Improvement
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 1.5,
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.95)',
                      letterSpacing: '-0.01em',
                      fontSize: '1.75rem',
                    }}
                  >
                    {avgImprovement.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                    Average performance improvement
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: 'rgba(17, 17, 26, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#ffffff', fontSize: '1.25rem' }}>
                Total Time Saved
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 1.5,
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.95)',
                      letterSpacing: '-0.01em',
                      fontSize: '1.75rem',
                    }}
                  >
                    {totalTimeSaved > 1000
                      ? `${(totalTimeSaved / 1000).toFixed(2)}s`
                      : `${totalTimeSaved.toFixed(0)}ms`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                    Cumulative time savings
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
};

