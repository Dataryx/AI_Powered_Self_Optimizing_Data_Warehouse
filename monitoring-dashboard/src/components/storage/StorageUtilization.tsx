/**
 * Storage Utilization Component
 * Displays storage utilization by layer and table with modern visualizations
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { apiService } from '../../services/api';

interface TableUtilization {
  table: string;
  total_size: string;
  size_bytes: number;
  table_size: string;
  index_size: string;
  percentage: number;
  overall_percentage: number;
}

interface UtilizationData {
  [key: string]: {
    tables: TableUtilization[];
    total_size: string;
    total_bytes: number;
    table_count: number;
  };
}

const LAYER_COLORS = {
  bronze: '#f59e0b',
  silver: '#6366f1',
  gold: '#10b981',
};

export const StorageUtilization: React.FC = () => {
  const [utilization, setUtilization] = useState<UtilizationData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUtilization();
    const interval = setInterval(fetchUtilization, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchUtilization = async () => {
    try {
      const data = await apiService.getStorageUtilization();
      setUtilization(data.utilization || {});
      setLoading(false);
    } catch (err) {
      console.error('Error fetching storage utilization:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading storage utilization...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Prepare pie chart data
  const pieData = Object.entries(utilization)
    .filter(([key]) => key !== '_total')
    .map(([layer, data]) => ({
      name: layer.toUpperCase(),
      value: data.total_bytes,
      color: LAYER_COLORS[layer as keyof typeof LAYER_COLORS] || '#64748b',
    }));

  // Prepare bar chart data (top tables)
  const allTables = Object.entries(utilization)
    .filter(([key]) => key !== '_total')
    .flatMap(([layer, data]) =>
      data.tables.map((table) => ({
        name: `${layer}.${table.table}`,
        layer,
        size: table.size_bytes,
        percentage: table.overall_percentage,
        color: LAYER_COLORS[layer as keyof typeof LAYER_COLORS] || '#64748b',
      }))
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const totalSize = utilization._total?.total_size || '0 MB';

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.1rem',
            }}
          >
            Storage Utilization
          </Typography>
          <Box
            sx={{
              px: 2,
              py: 0.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', display: 'block' }}>
              Total Storage
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {totalSize}
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {/* Pie Chart - By Layer */}
          <Grid item xs={12} md={4}>
            <Box sx={{ width: '100%', height: 300 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}>
                By Layer
              </Typography>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => {
                      const mb = value / (1024 * 1024);
                      return `${mb.toFixed(2)} MB`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Bar Chart - Top Tables */}
          <Grid item xs={12} md={8}>
            <Box sx={{ width: '100%', height: 300 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Top 10 Tables by Size
              </Typography>
              <ResponsiveContainer>
                <BarChart data={allTables} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                    tickFormatter={(value) => `${(value / (1024 * 1024)).toFixed(0)} MB`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${(value / (1024 * 1024)).toFixed(2)} MB`, 'Size']}
                  />
                  <Bar dataKey="size" radius={[0, 10, 10, 0]} animationDuration={1000}>
                    {allTables.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Layer Breakdown */}
          {(['bronze', 'silver', 'gold'] as const).map((layer) => {
            const layerData = utilization[layer];
            if (!layerData) return null;

            const layerColor = LAYER_COLORS[layer];
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
                    {layer.toUpperCase()} Layer
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: layerColor, fontSize: '1.2rem' }}>
                      {layerData.total_size}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {layerData.table_count} tables
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {topTables.map((table) => (
                      <Box
                        key={table.table}
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          backgroundColor: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', flex: 1 }}>
                            {table.table}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.75rem' }}>
                            {table.total_size}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: `${layerColor}20`,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${table.percentage}%`,
                              backgroundColor: layerColor,
                              borderRadius: 2,
                              transition: 'width 0.3s',
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
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

