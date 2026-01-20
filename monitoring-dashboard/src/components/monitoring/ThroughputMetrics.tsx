/**
 * Throughput Metrics Component
 * Displays throughput (records/second) with modern charts
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
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

interface ThroughputData {
  table: string;
  layer: string;
  records_per_second: number;
  total_records: number;
  total_operations: number;
}

interface ThroughputMetricsProps {
  refreshKey?: number;
}

export const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({ refreshKey = 0 }) => {
  const [throughput, setThroughput] = useState<ThroughputData[]>([]);
  const [overallThroughput, setOverallThroughput] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThroughput();
    const interval = setInterval(fetchThroughput, 10000); // Refresh every 10 seconds for real-time throughput
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const fetchThroughput = async () => {
    try {
      const data = await apiService.getThroughputMetrics();
      setThroughput(data.throughput || []);
      setOverallThroughput(data.overall_throughput || 0);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching throughput metrics:', err);
      setLoading(false);
    }
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

  const chartData = throughput.slice(0, 10).map((item, index) => ({
    name: item.table.split('.')[1] || item.table,
    throughput: item.records_per_second,
    color: COLORS[index % COLORS.length],
  }));

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading throughput metrics...</Typography>
        </CardContent>
      </Card>
    );
  }

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
            Throughput Metrics
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
              Overall
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {overallThroughput.toFixed(2)} rec/s
            </Typography>
          </Box>
        </Box>

        <Box sx={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 30, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748b"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value.toFixed(1)} rec/s`}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={160}
                stroke="#64748b"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                  padding: '12px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)} records/second`, 'Throughput']}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
              />
              <Bar dataKey="throughput" radius={[0, 10, 10, 0]} animationDuration={1000}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          {throughput.slice(0, 6).map((item, index) => (
            <Grid item xs={6} md={4} key={index}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}10 0%, rgba(255,255,255,0.8) 100%)`,
                  border: `1px solid ${COLORS[index % COLORS.length]}30`,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}>
                  {item.table}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: COLORS[index % COLORS.length],
                    fontSize: '1rem',
                    mt: 0.5,
                  }}
                >
                  {item.records_per_second.toFixed(2)} rec/s
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {item.total_records.toLocaleString()} total
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

