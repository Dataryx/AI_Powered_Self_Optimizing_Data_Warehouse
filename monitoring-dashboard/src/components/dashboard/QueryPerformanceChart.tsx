import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getQueryPerformance, QueryPerformancePoint } from '../../services/api';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    return (
      <Box
        sx={{
          background: 'rgba(17, 17, 26, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 2,
          p: 2.5,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          minWidth: 200,
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 600, 
            display: 'block', 
            mb: 2, 
            color: 'rgba(255, 255, 255, 0.95)', 
            fontSize: '0.8rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            pb: 1,
          }}
        >
          {dateStr} {timeStr}
        </Typography>
        {payload
          .sort((a: any, b: any) => {
            const order = ['avg', 'p50', 'p95', 'p99'];
            return order.indexOf(a.dataKey) - order.indexOf(b.dataKey);
          })
          .map((entry: any, index: number) => {
            // Map data keys to proper names
            const nameMap: { [key: string]: string } = {
              'avg': 'Average',
              'p50': 'Median (P50)',
              'p95': '95th Percentile',
              'p99': '99th Percentile',
            };
            const displayName = nameMap[entry.dataKey] || entry.name;
            
            return (
              <Box 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: 2, 
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: entry.color || '#64748b',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.75)', 
                      fontWeight: 500, 
                      fontSize: '0.75rem',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {displayName}
                  </Typography>
                </Box>
              <Typography
                variant="caption"
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.95)', 
                  fontWeight: 600, 
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              >
                {entry.value.toFixed(2)}ms
              </Typography>
            </Box>
            );
          })}
      </Box>
    );
  }
  return null;
};

export const QueryPerformanceChart: React.FC = () => {
  const [data, setData] = useState<QueryPerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const performanceData = await getQueryPerformance();
        setData(performanceData);
      } catch (error) {
        console.error('Error loading query performance:', error);
        setData([]); // Show empty state on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pb: 3 }}>
          <CircularProgress size={40} sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.length > 0 ? data : [];

  return (
    <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 700, 
              color: '#ffffff',
              fontSize: '1.25rem',
            }}
          >
            Query Performance
          </Typography>
          {chartData.length > 0 && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.75rem',
              }}
            >
              {chartData.length} data point{chartData.length !== 1 ? 's' : ''} • Real-time from database
            </Typography>
          )}
        </Box>
        
        {chartData.length === 0 ? (
          <Box 
            sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 350,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              No data available
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
              Query performance data will appear here as it is collected
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 350, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData} 
                margin={{ top: 10, right: 25, left: 10, bottom: 10 }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="rgba(255, 255, 255, 0.06)" 
                  vertical={false}
                />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 11, fontWeight: 400 }}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  }}
                />
                <YAxis 
                  tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 11, fontWeight: 400 }}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                  tickFormatter={(value) => `${value}ms`}
                  label={{ 
                    value: 'Response Time', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ 
                    color: 'rgba(255, 255, 255, 0.7)', 
                    fontSize: '12px', 
                    paddingTop: '20px',
                  }}
                  iconType="line"
                  iconSize={14}
                />
                {/* Average line - solid, prominent with smooth curve */}
                <Line
                  type="basis"
                  dataKey="avg"
                  stroke="#94a3b8"
                  strokeWidth={2.5}
                  dot={{ fill: '#94a3b8', r: 4, strokeWidth: 2, stroke: 'rgba(255, 255, 255, 0.2)' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#94a3b8' }}
                  name="Average"
                />
                {/* P50 line - medium weight with smooth curve */}
                <Line
                  type="basis"
                  dataKey="p50"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={{ fill: '#64748b', r: 3, strokeWidth: 1.5, stroke: 'rgba(255, 255, 255, 0.2)' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#64748b' }}
                  name="Median (P50)"
                />
                {/* P95 line - thicker for visibility with smooth curve */}
                <Line
                  type="basis"
                  dataKey="p95"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  dot={{ fill: '#cbd5e1', r: 3, strokeWidth: 1.5, stroke: 'rgba(255, 255, 255, 0.2)' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#cbd5e1' }}
                  name="95th Percentile"
                />
                {/* P99 line - most prominent for outliers with smooth curve */}
                <Line
                  type="basis"
                  dataKey="p99"
                  stroke="#e2e8f0"
                  strokeWidth={2}
                  dot={{ fill: '#e2e8f0', r: 3, strokeWidth: 1.5, stroke: 'rgba(255, 255, 255, 0.2)' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#e2e8f0' }}
                  name="99th Percentile"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

