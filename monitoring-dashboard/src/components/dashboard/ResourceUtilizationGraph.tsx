/**
 * Resource Utilization Graph Component
 * CPU, Memory, and Disk I/O visualization.
 */

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Typography, Box } from '@mui/material';
import { useWebSocket } from '../../hooks/useWebSocket';

export const ResourceUtilizationGraph: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const { messages } = useWebSocket({ channels: ['metrics'], autoConnect: true });

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.channel === 'metrics' && latestMessage.data) {
      const timestamp = new Date(latestMessage.timestamp).toLocaleTimeString();
      setData((prev) => {
        const newData = [...prev, {
          time: timestamp,
          CPU: latestMessage.data.cpu_utilization || 0,
          Memory: latestMessage.data.memory_utilization || 0,
          DiskIO: latestMessage.data.disk_io_utilization || 0,
        }];
        return newData.slice(-50);
      });
    }
  }, [messages]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Resource Utilization
      </Typography>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: 'Utilization (%)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="CPU" stackId="1" stroke="#8884d8" fill="#8884d8" />
          <Area type="monotone" dataKey="Memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
          <Area type="monotone" dataKey="DiskIO" stackId="1" stroke="#ffc658" fill="#ffc658" />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default ResourceUtilizationGraph;
