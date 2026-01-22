/**
 * Anomaly Detection Component
 * Displays detected anomalies
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
} from '@mui/material';
import { Refresh, BugReport, TrendingUp, TrendingDown } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiService } from '../../services/api';

interface AnomalyDetectionProps {
  refreshKey?: number;
}

export const AnomalyDetection: React.FC<AnomalyDetectionProps> = ({ refreshKey = 0 }) => {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAnomalies = useCallback(async () => {
    try {
      const data = await apiService.getAnomalies();
      const anomaliesList = data.anomalies || data || [];
      setAnomalies(anomaliesList);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 30000);
    return () => clearInterval(interval);
  }, [fetchAnomalies, refreshKey]);

  // Generate trend data from anomalies
  const trendData = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date();
    hour.setHours(hour.getHours() - (23 - i));
    const hourAnomalies = anomalies.filter(a => {
      const alertTime = new Date(a.timestamp || a.created_at || Date.now());
      return alertTime.getHours() === hour.getHours();
    });
    return {
      hour: hour.toLocaleTimeString('en-US', { hour: '2-digit' }),
      count: hourAnomalies.length,
    };
  });

  if (loading && anomalies.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading anomaly detection...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        maxHeight: '600px',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BugReport sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Anomaly Detection
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                ML-powered anomaly detection
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={anomalies.length}
              size="small"
              sx={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <IconButton
              onClick={fetchAnomalies}
              size="small"
              sx={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                '&:hover': {
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s',
                width: 28,
                height: 28,
              }}
            >
              <Refresh sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Chart */}
        {trendData.length > 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Anomaly Trend (24 Hours)
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 9 }} stroke="#64748b" />
                <RechartsTooltip />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : null}

        {/* Anomalies List */}
        {anomalies.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 2, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No anomalies detected
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
            {anomalies.slice(0, 5).map((anomaly, index) => (
              <Box
                key={anomaly.anomaly_id || index}
                sx={{
                  p: 1,
                  mb: 1,
                  borderRadius: 1.5,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'rgba(245, 158, 11, 0.1)',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.5 }}>
                  {anomaly.title || anomaly.type || 'Anomaly Detected'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {anomaly.message || anomaly.description || 'Anomalous pattern detected'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
                  {new Date(anomaly.timestamp || anomaly.created_at || Date.now()).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

