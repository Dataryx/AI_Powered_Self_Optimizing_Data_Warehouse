import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { mockQueryPerformance } from '../../services/api';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          background: 'rgba(17, 17, 26, 0.98)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 2,
          p: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1.5, color: '#ffffff', fontSize: '0.75rem' }}>
          {payload[0].payload.timestamp.split('T')[1]?.slice(0, 5)}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color || '#6366f1',
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: '#f1f5f9', fontWeight: 500, fontSize: '0.75rem' }}
            >
              {entry.name}: <strong style={{ color: entry.color }}>{entry.value.toFixed(0)}ms</strong>
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }
  return null;
};

export const QueryPerformanceChart: React.FC = () => {
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
          Query Performance
        </Typography>
        <Box sx={{ flex: 1, minHeight: 350, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockQueryPerformance} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              />
              <YAxis 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ color: '#f1f5f9', fontSize: '12px', paddingTop: '20px' }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="p50"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorP50)"
                name="P50"
              />
              <Area
                type="monotone"
                dataKey="p95"
                stroke="#ec4899"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorP95)"
                name="P95"
              />
              <Area
                type="monotone"
                dataKey="p99"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorP99)"
                name="P99"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

