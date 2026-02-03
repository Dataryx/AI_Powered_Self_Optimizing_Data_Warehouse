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
  
  // Handle empty or missing data and ensure proper sorting
  const safeData = data || [];
  
  // Process and sort data by date
  let chartData = safeData.length > 0 
    ? safeData
        .map((item) => ({
          date: item.date,
          dateObj: new Date(item.date),
          sales: item.count || 0,
          revenue: item.revenue || 0,
        }))
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        .map((item) => ({
          date: item.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: item.sales,
          revenue: item.revenue,
        }))
    : // Generate placeholder data for last 30 days if no data
      Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: 0,
          revenue: 0,
        };
      });
  
  // Calculate max values for better Y-axis scaling
  const maxSales = Math.max(...chartData.map(d => d.sales), 1);
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  return (
    <Card
      sx={{
        height: '100%',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: '#1f2937',
                fontSize: '1rem',
                mb: 0.5,
              }}
            >
              Sales Trend (Last 30 Days)
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#6b7280',
                fontSize: '0.75rem',
              }}
            >
              Daily sales count and revenue
            </Typography>
          </Box>
        </Box>
        <Box sx={{ width: '100%', height: 320, mt: 1 }}>
          <ResponsiveContainer>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              onMouseMove={(state) => setActiveIndex(state?.activeTooltipIndex ?? null)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#ec4899" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#e5e7eb" 
                opacity={0.6}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                tick={{ fill: '#6b7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                stroke="#6366f1"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6366f1' }}
                domain={[0, maxSales * 1.1]}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#ec4899"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#ec4899' }}
                domain={[0, maxRevenue * 1.1]}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  padding: '12px 16px',
                }}
                cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5 5', opacity: 0.5 }}
                formatter={(value: number, name: string) => {
                  if (name === 'Sales Count') {
                    return [value.toLocaleString(), 'Sales'];
                  }
                  if (name === 'Revenue ($)') {
                    return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Revenue'];
                  }
                  return [value, name];
                }}
                labelStyle={{ 
                  color: '#1f2937', 
                  fontWeight: 600, 
                  fontSize: '12px',
                  marginBottom: '8px'
                }}
                itemStyle={{ 
                  color: '#6b7280', 
                  fontSize: '12px',
                  padding: '2px 0'
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px', paddingBottom: '10px' }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>
                    {value === 'Sales Count' ? 'Sales' : value === 'Revenue ($)' ? 'Revenue' : value}
                  </span>
                )}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#colorSales)"
                name="Sales Count"
                dot={false}
                activeDot={{ 
                  r: 5, 
                  fill: '#6366f1', 
                  strokeWidth: 2, 
                  stroke: '#ffffff',
                  style: { filter: 'drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3))' }
                }}
                animationDuration={800}
                animationBegin={0}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#ec4899"
                strokeWidth={2.5}
                fill="url(#colorRevenue)"
                name="Revenue ($)"
                dot={false}
                activeDot={{ 
                  r: 5, 
                  fill: '#ec4899', 
                  strokeWidth: 2, 
                  stroke: '#ffffff',
                  style: { filter: 'drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3))' }
                }}
                animationDuration={800}
                animationBegin={150}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};



