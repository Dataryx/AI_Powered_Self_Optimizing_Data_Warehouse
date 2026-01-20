/**
 * Top Products Chart Component
 * Premium bar chart with gradient fills and enhanced organization
 */

import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

interface TopProductsChartProps {
  data: Array<{ product: string; sales_count: number; revenue: number; quantity: number }>;
}

const GRADIENT_COLORS = [
  ['#6366f1', '#8b5cf6'], // Indigo to Purple
  ['#ec4899', '#f472b6'], // Pink
  ['#f59e0b', '#fbbf24'], // Amber
  ['#10b981', '#34d399'], // Emerald
  ['#3b82f6', '#60a5fa'], // Blue
  ['#ef4444', '#f87171'], // Red
  ['#06b6d4', '#22d3ee'], // Cyan
  ['#8b5cf6', '#a78bfa'], // Purple
  ['#14b8a6', '#2dd4bf'], // Teal
  ['#f97316', '#fb923c'], // Orange
];

// Custom label component for bars
const CustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  const formattedValue = `$${(value / 1000000).toFixed(1)}M`;
  return (
    <text
      x={(x || 0) + (width || 0) + 8}
      y={(y || 0) + 10}
      fill="#64748b"
      fontSize={11}
      fontWeight={600}
      textAnchor="start"
    >
      {formattedValue}
    </text>
  );
};

// Truncate product name intelligently
const truncateProductName = (name: string, maxLength: number = 30) => {
  if (name.length <= maxLength) return name;
  // Try to break at word boundary
  const truncated = name.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
};

export const TopProductsChart: React.FC<TopProductsChartProps> = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .sort((a, b) => b.revenue - a.revenue) // Ensure sorted by revenue
      .slice(0, 10) // Take top 10
      .map((item, index) => ({
        rank: index + 1,
        name: truncateProductName(item.product, 28),
        fullName: item.product,
        revenue: item.revenue,
        sales: item.sales_count,
        quantity: item.quantity,
        colorStart: GRADIENT_COLORS[index % GRADIENT_COLORS.length][0],
        colorEnd: GRADIENT_COLORS[index % GRADIENT_COLORS.length][1],
        avgRevenue: item.revenue / item.sales_count,
      }));
  }, [data]);

  const totalRevenue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.revenue, 0);
  }, [chartData]);

  return (
    <Card
      sx={{
        height: '100%',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(236, 72, 153, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 20px 40px -12px rgba(236, 72, 153, 0.2), 0 0 0 1px rgba(236, 72, 153, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
              fontSize: '1.1rem',
            }}
          >
            Top Products by Revenue
          </Typography>
          <Chip
            label={`${chartData.length} products`}
            size="small"
            sx={{
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              color: '#ec4899',
              fontWeight: 600,
              fontSize: '0.75rem',
              height: '24px',
            }}
          />
        </Box>
        
        {/* Summary Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: '120px' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}>
              Total Revenue
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#ec4899', fontSize: '0.875rem' }}>
              ${(totalRevenue / 1000000).toFixed(1)}M
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: '120px' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}>
              Avg per Product
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#8b5cf6', fontSize: '0.875rem' }}>
              ${(totalRevenue / chartData.length / 1000).toFixed(0)}K
            </Typography>
          </Box>
        </Box>

        <Box sx={{ width: '100%', height: 380, mt: 1 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 100, top: 10, bottom: 10 }}
              barCategoryGap="15%"
            >
              <defs>
                {chartData.map((entry, index) => (
                  <linearGradient
                    key={`gradient-${index}`}
                    id={`gradient-${index}`}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0%" stopColor={entry.colorStart} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={entry.colorEnd} stopOpacity={0.9} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                opacity={0.5}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                stroke="#64748b"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                domain={[0, 'dataMax + dataMax * 0.1']}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={180}
                stroke="#64748b"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#1e293b' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(236, 72, 153, 0.2)',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                  padding: '14px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string, props: any) => {
                  if (name === 'Revenue ($)') {
                    return [
                      `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                      'Revenue',
                    ];
                  }
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload;
                  return (
                    <Box sx={{ mb: 1, fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                      #{data?.rank}. {data?.fullName || label}
                    </Box>
                  );
                }}
                content={(props: any) => {
                  const { active, payload } = props;
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        border: '1px solid rgba(236, 72, 153, 0.2)',
                        borderRadius: 2,
                        p: 1.5,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e293b', display: 'block', mb: 1 }}>
                        #{data.rank}. {data.fullName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Revenue:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ec4899' }}>
                            ${data.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Sales:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {data.sales.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Avg:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            ${data.avgRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                }}
                cursor={{ fill: 'rgba(236, 72, 153, 0.08)' }}
              />
              <Bar
                dataKey="revenue"
                name="Revenue ($)"
                radius={[0, 10, 10, 0]}
                animationDuration={1200}
                animationBegin={0}
                minPointSize={5}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#gradient-${index})`}
                    style={{
                      filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))',
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
                <LabelList
                  content={<CustomBarLabel />}
                  position="right"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};



