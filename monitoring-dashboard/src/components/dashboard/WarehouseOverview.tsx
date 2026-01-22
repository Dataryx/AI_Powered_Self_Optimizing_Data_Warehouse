/**
 * Warehouse Overview Component
 * Premium layer cards with glassmorphism and animations
 */

import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, Chip } from '@mui/material';
import { Storage, TableChart, DataObject } from '@mui/icons-material';

interface WarehouseOverviewProps {
  summary: {
    bronze: { table_count: number; estimated_rows: number; total_size: string };
    silver: { table_count: number; estimated_rows: number; total_size: string };
    gold: { table_count: number; estimated_rows: number; total_size: string };
  };
}

export const WarehouseOverview: React.FC<WarehouseOverviewProps> = ({ summary }) => {
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  // Ensure summary has all required properties with defaults
  const safeSummary = {
    bronze: summary?.bronze || { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
    silver: summary?.silver || { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
    gold: summary?.gold || { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
  };

  const layers = [
    {
      name: 'Bronze',
      data: safeSummary.bronze,
      gradient: ['#f59e0b', '#fbbf24'],
      color: '#f59e0b',
      icon: <Storage />,
      description: 'Raw Data',
      bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #ffffff 100%)',
    },
    {
      name: 'Silver',
      data: safeSummary.silver,
      gradient: ['#6366f1', '#8b5cf6'],
      color: '#6366f1',
      icon: <TableChart />,
      description: 'Cleaned Data',
      bgGradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #ffffff 100%)',
    },
    {
      name: 'Gold',
      data: safeSummary.gold,
      gradient: ['#10b981', '#34d399'],
      color: '#10b981',
      icon: <DataObject />,
      description: 'Analytics Data',
      bgGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #ffffff 100%)',
    },
  ];

  return (
    <Grid container spacing={3}>
      {layers.map((layer) => {
        const isHovered = hoveredLayer === layer.name;
        return (
          <Grid item xs={12} md={4} key={layer.name}>
            <Card
              onMouseEnter={() => setHoveredLayer(layer.name)}
              onMouseLeave={() => setHoveredLayer(null)}
              sx={{
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: layer.bgGradient,
                border: `2px solid ${layer.color}30`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  background: `linear-gradient(90deg, ${layer.gradient[0]} 0%, ${layer.gradient[1]} 100%)`,
                  transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                '&:hover': {
                  transform: 'translateY(-8px) scale(1.02)',
                  boxShadow: `0 20px 40px -12px ${layer.color}40, 0 0 0 1px ${layer.color}20`,
                  borderColor: `${layer.color}60`,
                },
              }}
            >
              <CardContent sx={{ p: 2, position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${layer.gradient[0]}15 0%, ${layer.gradient[1]}08 100%)`,
                      color: layer.color,
                      mr: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isHovered ? 'rotate(5deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                      boxShadow: `0 4px 12px ${layer.color}25`,
                    }}
                  >
                    {layer.icon}
                  </Box>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        background: `linear-gradient(135deg, ${layer.gradient[0]} 0%, ${layer.gradient[1]} 100%)`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.01em',
                        fontSize: '1.1rem',
                      }}
                    >
                      {layer.name} Layer
                    </Typography>
                    <Chip
                      label={layer.description}
                      size="small"
                      sx={{
                        mt: 0.5,
                        backgroundColor: `${layer.color}15`,
                        color: layer.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: '24px',
                      }}
                    />
                  </Box>
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  {[
                    { label: 'Tables', value: layer.data.table_count, format: (v: number) => v.toString() },
                    { label: 'Rows', value: layer.data.estimated_rows, format: (v: number) => v.toLocaleString() },
                    { label: 'Size', value: layer.data.total_size, format: (v: string) => v },
                  ].map((stat, idx) => (
                    <Box
                      key={stat.label}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: idx < 2 ? 1.5 : 0,
                        p: 1,
                        borderRadius: 1.5,
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        transition: 'all 0.3s',
                        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        {stat.label}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 700,
                          color: layer.color,
                          letterSpacing: '-0.01em',
                          fontSize: '0.95rem',
                        }}
                      >
                        {stat.format(stat.value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};



