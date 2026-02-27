/**
 * Warehouse Overview Component
 * Metric cards styled like sample dashboard
 */

import React from 'react';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import { Storage, TableChart, DataObject } from '@mui/icons-material';
import { useThemeColors } from '../../theme/useThemeColors';

interface WarehouseOverviewProps {
  summary: {
    bronze: { table_count: number; estimated_rows: number; total_size: string };
    silver: { table_count: number; estimated_rows: number; total_size: string };
    gold: { table_count: number; estimated_rows: number; total_size: string };
  };
}

export const WarehouseOverview: React.FC<WarehouseOverviewProps> = ({ summary }) => {
  const colors = useThemeColors();
  const safeSummary = {
    bronze: summary?.bronze || { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
    silver: summary?.silver || { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
    gold: summary?.gold || { table_count: 0, estimated_rows: 0, total_size: '0 MB' },
  };

  const layers = [
    {
      name: 'Bronze Layer',
      data: safeSummary.bronze,
      color: colors.layerBronze.text,
      bgColor: colors.layerBronze.bg,
      icon: <Storage sx={{ fontSize: 14 }} />,
      mainValue: safeSummary.bronze.table_count.toString(),
      subtitle: `${safeSummary.bronze.estimated_rows.toLocaleString()} rows`,
    },
    {
      name: 'Silver Layer',
      data: safeSummary.silver,
      color: colors.layerSilver.text,
      bgColor: colors.layerSilver.bg,
      icon: <TableChart sx={{ fontSize: 14 }} />,
      mainValue: safeSummary.silver.table_count.toString(),
      subtitle: `${safeSummary.silver.estimated_rows.toLocaleString()} rows`,
    },
    {
      name: 'Gold Layer',
      data: safeSummary.gold,
      color: colors.layerGold.text,
      bgColor: colors.layerGold.bg,
      icon: <DataObject sx={{ fontSize: 14 }} />,
      mainValue: safeSummary.gold.table_count.toString(),
      subtitle: `${safeSummary.gold.estimated_rows.toLocaleString()} rows`,
    },
  ];

  return (
    <Card
      sx={{
        borderRadius: 2,
        bgcolor: colors.paper,
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 1.5, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: 1.5 } }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: colors.text,
            fontSize: '0.875rem',
            mb: 1,
            flexShrink: 0,
          }}
        >
          Medallion Architecture
        </Typography>
        <Grid container spacing={0.75} sx={{ flex: 1, minHeight: 0 }}>
          {layers.map((layer) => (
            <Grid item xs={4} key={layer.name} sx={{ display: 'flex', minHeight: 0 }}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: layer.bgColor,
                  border: 'none',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.3s ease',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <CardContent sx={{ p: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', '&:last-child': { pb: 1 } }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: layer.color,
                      mb: 0.75,
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {layer.icon}
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: colors.text,
                      fontSize: '0.875rem',
                      lineHeight: 1.2,
                      mb: 0.3,
                    }}
                  >
                    {layer.mainValue}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: colors.textSecondary,
                      fontSize: '0.65rem',
                      fontWeight: 500,
                      mb: 0.25,
                      display: 'block',
                      lineHeight: 1.3,
                    }}
                  >
                    {layer.name.replace(' Layer', '')}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: colors.primary,
                      fontSize: '0.6rem',
                      fontWeight: 500,
                      lineHeight: 1.3,
                    }}
                  >
                    {layer.subtitle}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};
