/**
 * Sales Chart Component
 * Premium sales visualization with smooth animations
 */

import React, { useState } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  defs,
  linearGradient,
  stop,
} from 'recharts';

interface SalesChartProps {
  data: Array<{ date: string; count: number; revenue: number }>;
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales: item.count,
    revenue: item.revenue,
  }));

  return (
    <Card
      sx={{
        height: '100%',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 20px 40px -12px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
              fontSize: '1.1rem',
            }}
          >
            Sales Trend (Last 30 Days)
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 300, mt: 1.5 }}>
          <ResponsiveContainer>
            <AreaChart
              data={chartData}
              onMouseMove={(state) => setActiveIndex(state?.activeTooltipIndex ?? null)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#6366f1"
                style={{ fontSize: '12px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#ec4899"
                style={{ fontSize: '12px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  padding: '12px',
                }}
                cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }}
                formatter={(value: number, name: string) => {
                  if (name === 'Sales Count') return [value.toLocaleString(), 'Sales Count'];
                  if (name === 'Revenue ($)') return [`$${value.toLocaleString()}`, 'Revenue'];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
                formatter={(value) => <span style={{ fontWeight: 600, fontSize: '12px' }}>{value}</span>}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="#6366f1"
                strokeWidth={3}
                fill="url(#colorSales)"
                name="Sales Count"
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                animationDuration={1000}
                animationBegin={0}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#ec4899"
                strokeWidth={3}
                fill="url(#colorRevenue)"
                name="Revenue ($)"
                dot={{ fill: '#ec4899', r: 4 }}
                activeDot={{ r: 6, fill: '#ec4899', strokeWidth: 2, stroke: '#ffffff' }}
                animationDuration={1000}
                animationBegin={200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};



