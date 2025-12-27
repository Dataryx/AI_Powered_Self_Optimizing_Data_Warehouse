import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  gradient: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  gradient,
}) => {
  const isPositive = change !== undefined && change > 0;

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        background: `linear-gradient(135deg, ${gradient})`,
        position: 'relative',
        overflow: 'visible',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: gradient,
          borderRadius: '16px 16px 0 0',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
          >
            {icon}
          </Box>
          {change !== undefined && (
            <Chip
              icon={isPositive ? <TrendingUp /> : <TrendingDown />}
              label={`${isPositive ? '+' : ''}${change.toFixed(1)}%`}
              size="small"
              sx={{
                background: isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: isPositive ? '#34d399' : '#f87171',
                fontWeight: 600,
                border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            />
          )}
        </Box>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            mb: 0.5,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};

