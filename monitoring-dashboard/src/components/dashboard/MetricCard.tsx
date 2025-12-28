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
              color: 'rgba(255, 255, 255, 0.8)',
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
                background: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isPositive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                fontWeight: 500,
                fontSize: '0.75rem',
                border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
          )}
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
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 400, fontSize: '0.875rem' }}>
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};

