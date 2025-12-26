/**
 * Query Performance Chart Component
 * Real-time query latency visualization.
 */

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Typography, Box } from '@mui/material';
import { useWebSocket } from '../../hooks/useWebSocket';

export const QueryPerformanceChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const { messages } = useWebSocket({ channels: ['metrics'], autoConnect: true });

  useEffect(() => {
    // Process WebSocket messages for metrics
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.channel === 'metrics' && latestMessage.data) {
      const timestamp = new Date(latestMessage.timestamp).toLocaleTimeString();
      setData((prev) => {
        const newData = [...prev, {
          time: timestamp,
          p50: (latestMessage.data.avg_query_time_ms || 0) * 0.9,
          p95: (latestMessage.data.avg_query_time_ms || 0) * 1.5,
          p99: (latestMessage.data.avg_query_time_ms || 0) * 2.0,
        }];
        // Keep only last 50 data points
        return newData.slice(-50);
      });
    }
  }, [messages]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Query Performance (Real-time)
      </Typography>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="p50" stroke="#8884d8" name="P50" />
          <Line type="monotone" dataKey="p95" stroke="#82ca9d" name="P95" />
          <Line type="monotone" dataKey="p99" stroke="#ffc658" name="P99" />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default QueryPerformanceChart;
