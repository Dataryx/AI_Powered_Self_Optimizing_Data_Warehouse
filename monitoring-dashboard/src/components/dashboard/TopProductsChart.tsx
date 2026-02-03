/**
 * Top Products Chart Component
 * Modern horizontal bar chart with improved design
 */

import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
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

interface TopProductsChartProps {
  data: Array<{ product: string; sales_count: number; revenue: number; quantity: number }>;
}

const COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#f97316', // Orange
];

// Truncate product name intelligently
const truncateProductName = (name: string, maxLength: number = 35) => {
  if (name.length <= maxLength) return name;
  const truncated = name.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
};

export const TopProductsChart: React.FC<TopProductsChartProps> = ({ data }) => {
  const chartData = useMemo(() => {
    const safeData = data || [];
    if (safeData.length === 0) {
      return [];
    }
    
    // Process and validate data from API
    const processedData = safeData
      .map((item: any) => ({
        product: item.product || item.product_name || 'Unknown Product',
        sales_count: item.sales_count || item.sales || 0,
        revenue: typeof item.revenue === 'number' ? item.revenue : parseFloat(item.revenue || 0),
        quantity: item.quantity || item.quantity_sold || 0,
      }))
      .filter((item) => item.revenue > 0) // Only include products with revenue
      .sort((a, b) => b.revenue - a.revenue) // Sort by revenue descending
      .slice(0, 10) // Take top 10
      .map((item, index) => ({
        rank: index + 1,
        name: truncateProductName(item.product, 35),
        fullName: item.product,
        revenue: item.revenue,
        sales: item.sales_count,
        quantity: item.quantity,
        color: COLORS[index % COLORS.length],
        avgRevenue: item.sales_count > 0 ? item.revenue / item.sales_count : 0,
      }));
    
    return processedData;
  }, [data]);

  const maxRevenue = useMemo(() => {
    return Math.max(...chartData.map(d => d.revenue), 1);
  }, [chartData]);

  // Show empty state if no data
  if (chartData.length === 0) {
    return (
      <Card
        sx={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
                Top Products by Revenue
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  fontSize: '0.75rem',
                }}
              >
                Top 10 products by revenue
              </Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No product data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: '#1f2937',
              fontSize: '1rem',
              mb: 0.5,
            }}
          >
            Top Products by Revenue
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#6b7280',
              fontSize: '0.75rem',
            }}
          >
            Top {chartData.length} products by revenue
          </Typography>
        </Box>

        <Box sx={{ width: '100%', height: 400, mt: 1 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 120, right: 20, top: 10, bottom: 10 }}
              barCategoryGap="12%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                opacity={0.6}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                stroke="#9ca3af"
                style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                tick={{ fill: '#6b7280' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                  return `$${value}`;
                }}
                domain={[0, maxRevenue * 1.15]}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={110}
                stroke="#9ca3af"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#1f2937' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  padding: '12px 16px',
                }}
                formatter={(value: number) => {
                  return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Revenue'];
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
                content={(props: any) => {
                  const { active, payload } = props;
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        border: '1px solid #e5e7eb',
                        borderRadius: 2,
                        p: 1.5,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1f2937', display: 'block', mb: 1 }}>
                        #{data.rank}. {data.fullName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            Revenue:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#6366f1' }}>
                            ${data.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            Sales:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {data.sales.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            Avg per Sale:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            ${data.avgRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                }}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
              />
              <Bar
                dataKey="revenue"
                name="Revenue"
                radius={[0, 6, 6, 0]}
                animationDuration={800}
                animationBegin={0}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{
                      opacity: 0.85,
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};



