/**
 * Compression Statistics Component
 * Displays compression ratios and statistics
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, LinearProgress } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { apiService } from '../../services/api';

interface TableCompression {
  table: string;
  total_size: string;
  table_size: string;
  row_count: number;
  compression_ratio: number;
  compression_percentage: number;
}

interface CompressionData {
  [key: string]: {
    tables: TableCompression[];
    average_compression_ratio: number;
  };
}

export const CompressionStats: React.FC = () => {
  const [compression, setCompression] = useState<CompressionData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompression();
    const interval = setInterval(fetchCompression, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchCompression = async () => {
    try {
      const data = await apiService.getCompressionStats();
      setCompression(data.compression || {});
      setLoading(false);
    } catch (err) {
      console.error('Error fetching compression stats:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading compression statistics...</Typography>
        </CardContent>
      </Card>
    );
  }

  const layers = ['bronze', 'silver', 'gold'] as const;
  const layerNames = { bronze: 'Bronze Layer', silver: 'Silver Layer', gold: 'Gold Layer' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };

  // Prepare chart data
  const chartData = layers
    .filter((layer) => compression[layer])
    .map((layer) => ({
      layer: layer.toUpperCase(),
      ratio: compression[layer].average_compression_ratio,
      color: layerColors[layer],
    }));

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 2.5,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '1.1rem',
          }}
        >
          Compression Statistics
        </Typography>

        {/* Compression Ratio Chart */}
        <Box sx={{ width: '100%', height: 300, mb: 3 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis
                dataKey="layer"
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Compression Ratio', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 12,
                }}
                formatter={(value: number) => [`${value.toFixed(2)}x`, 'Compression Ratio']}
              />
              <Bar dataKey="ratio" radius={[8, 8, 0, 0]} animationDuration={1000}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        {/* Layer Details */}
        <Grid container spacing={2}>
          {layers.map((layer) => {
            const layerData = compression[layer];
            if (!layerData) return null;

            const layerColor = layerColors[layer];
            const topTables = layerData.tables.slice(0, 5);

            return (
              <Grid item xs={12} md={4} key={layer}>
                <Card
                  sx={{
                    p: 2,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.8) 100%)`,
                    border: `2px solid ${layerColor}30`,
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor, mb: 1.5 }}>
                    {layerNames[layer]}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Avg Compression
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: layerColor, fontSize: '1.3rem' }}>
                      {layerData.average_compression_ratio.toFixed(2)}x
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {topTables.map((table) => {
                      const compressionPercent = table.compression_percentage;
                      return (
                        <Box
                          key={table.table}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            backgroundColor: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', flex: 1 }}>
                              {table.table}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.75rem' }}>
                              {table.compression_ratio.toFixed(2)}x
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(compressionPercent, 100)}
                              sx={{
                                flex: 1,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: `${layerColor}20`,
                                '& .MuiLinearProgress-bar': {
                                  background: `linear-gradient(90deg, ${layerColor} 0%, ${layerColor}80 100%)`,
                                  borderRadius: 3,
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: layerColor, fontSize: '0.7rem', minWidth: '40px' }}>
                              {compressionPercent.toFixed(1)}%
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                            {table.row_count.toLocaleString()} rows · {table.total_size}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};

