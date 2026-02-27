/**
 * Top Products Chart Component
 * Treemap visualization for top 20 products by revenue
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material';
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

interface TopProductsChartProps {
  data?: Array<{ product: string; sales_count: number; revenue: number; quantity: number }>;
}

// Human, earthy bar colors (from theme)
const BAR_COLORS = [
  '#c5dde4', // dusty blue tint
  '#c8d9c4', // sage tint
  '#e8c4b0', // terracotta tint
  '#e8d9a8', // ochre tint
  '#d4b8ba', // dusty rose tint
  '#b8c4cc', // slate tint
];

// Truncate product name for treemap tiles; break at word boundary when possible
const getShortName = (name: string, maxLength: number = 18) => {
  if (!name) return '';
  if (name.length <= maxLength) return name;
  const truncated = name.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.4) {
    return truncated.substring(0, lastSpace) + '…';
  }
  return truncated + '…';
};

// Format currency - always show in millions for treemap
const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    const millions = value / 1000000;
    return `$${millions.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return `$${thousands.toFixed(1)}K`;
  }
  return `$${Math.round(value)}`;
};

export const TopProductsChart: React.FC<TopProductsChartProps> = ({ data: propData }) => {
  const colors = useThemeColors();
  const [apiData, setApiData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getTopProducts(20);
        // Handle both response structures: {products: [...]} or direct array
        const products = response?.products || response || [];
        setApiData(products);
        console.log('TopProductsChart - Fetched from API:', products.length, 'products');
        console.log('TopProductsChart - Sample product:', products[0]);
      } catch (err: any) {
        console.error('TopProductsChart - Error fetching data:', err);
        setError(err.message || 'Failed to load top products');
        setApiData([]);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if no prop data provided
    if (!propData || propData.length === 0) {
      fetchData();
    } else {
      setApiData(propData);
      setLoading(false);
    }
  }, [propData]);

  const { totalRevenue, flatData } = useMemo(() => {
    // Use API data if available, otherwise use prop data
    const safeData = apiData.length > 0 ? apiData : (propData || []);
    
    if (safeData.length === 0) {
      return { totalRevenue: 0, flatData: [] };
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
      .slice(0, 20) // Take top 20
      .map((item, index) => ({
        name: item.product,
        shortName: getShortName(item.product, 18),
        revenue: item.revenue,
        sales: item.sales_count,
        quantity: item.quantity,
        rank: index + 1,
        barColor: BAR_COLORS[index % BAR_COLORS.length],
      }));

    const total = processedData.reduce((sum, item) => sum + item.revenue, 0);

    return { totalRevenue: total, flatData: processedData };
  }, [apiData, propData]);

  // Show loading state
  if (loading) {
    return (
      <Card
        sx={{
          bgcolor: colors.paper,
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
                Loading top products...
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <CircularProgress size={40} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card
        sx={{
          bgcolor: colors.paper,
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
                Error loading data
              </Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (flatData.length === 0) {
    return (
      <Card
        sx={{
          bgcolor: colors.paper,
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
                Top 20 products by revenue
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
        bgcolor: colors.paper,
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
            Top {flatData.length} products by revenue • Total: {formatCurrency(totalRevenue)}
          </Typography>
        </Box>
        
        <Box 
          sx={{ 
            width: '100%', 
            height: 420, 
            mt: 1, 
            position: 'relative', 
            backgroundColor: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: 1,
            overflow: 'hidden'
          }}
        >
          {flatData.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography variant="body2" sx={{ color: '#6b7280' }}>
                Processing data...
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={flatData}
                layout="vertical"
                margin={{ top: 12, right: 32, left: 16, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrency}
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={160}
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0]?.payload;
                    if (!data || !data.name) return null;

                    return (
                      <Box
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.98)',
                          border: '1px solid #e5e7eb',
                          borderRadius: 2,
                          p: 1.25,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#1f2937', display: 'block', mb: 0.75 }}>
                          #{data.rank}. {data.name}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                              Revenue:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                              {formatCurrency(data.revenue)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                              Sales:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {data.sales?.toLocaleString() || 0}
                            </Typography>
                          </Box>
                          {data.quantity && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                              <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                Quantity:
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {data.quantity.toLocaleString()}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 4, 4]}>
                  {flatData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.barColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
