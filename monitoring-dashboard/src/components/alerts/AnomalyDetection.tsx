/**
 * Anomaly Detection Component
 * ML-powered anomaly detection with trend visualization
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import { Refresh, TrendingUp } from '@mui/icons-material';
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

interface Anomaly {
  anomaly_id?: string;
  type?: string;
  title?: string;
  message?: string;
  description?: string;
  timestamp?: string;
  created_at?: string;
}

export const AnomalyDetection: React.FC<AnomalyDetectionProps> = ({ refreshKey = 0 }) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnomalies = useCallback(async () => {
    try {
      const data = await apiService.getAnomalies();
      const anomaliesList = data.anomalies || data || [];
      setAnomalies(Array.isArray(anomaliesList) ? anomaliesList : []);
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

  // Generate trend data from anomalies (last 24 hours)
  const trendData = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date();
    hour.setHours(hour.getHours() - (23 - i));
    const hourAnomalies = anomalies.filter(a => {
      const alertTime = new Date(a.timestamp || a.created_at || Date.now());
      return alertTime.getHours() === hour.getHours() && 
             alertTime.getDate() === hour.getDate();
    });
    return {
      hour: hour.toLocaleTimeString('en-US', { hour: '2-digit' }),
      count: hourAnomalies.length,
    };
  });

  const getAnomalyType = (anomaly: Anomaly): string => {
    const type = anomaly.type?.toLowerCase() || '';
    const title = anomaly.title?.toLowerCase() || '';
    const message = anomaly.message?.toLowerCase() || '';
    const combined = `${type} ${title} ${message}`;
    
    if (combined.includes('query') || combined.includes('latency')) return 'Query Latency';
    if (combined.includes('etl') || combined.includes('duration')) return 'ETL Duration';
    if (combined.includes('resource') || combined.includes('utilization')) return 'Resource Utilization';
    if (combined.includes('freshness')) return 'Data Freshness';
    return 'System';
  };

  if (loading && anomalies.length === 0) {
    return (
      <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading anomaly detection...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
              Anomaly Detection
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Anomalies are detected using historical baselines and pattern deviations.
            </Typography>
          </Box>
          <IconButton
            onClick={fetchAnomalies}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s',
            }}
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Trend Visualization */}
        {anomalies.length > 0 && (
          <Box sx={{ mb: 2, height: 120 }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Anomaly Trend (Last 24 Hours)
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 10 }} 
                  stroke="#64748b"
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                <RechartsTooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Anomalies List or Empty State */}
        {anomalies.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <TrendingUp sx={{ fontSize: 48, color: '#10b981', opacity: 0.3, mb: 1.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
              No anomalies detected
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              System patterns are within expected ranges
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {anomalies.slice(0, 5).map((anomaly, index) => {
              const anomalyType = getAnomalyType(anomaly);
              const typeColors: Record<string, string> = {
                'Query Latency': '#ef4444',
                'ETL Duration': '#f59e0b',
                'Resource Utilization': '#3b82f6',
                'Data Freshness': '#8b5cf6',
                'System': '#64748b',
              };
              const color = typeColors[anomalyType] || '#64748b';

              return (
                <Box
                  key={anomaly.anomaly_id || index}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: `1px solid ${color}40`,
                    backgroundColor: `${color}08`,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                        {anomaly.title || anomaly.type || 'Anomaly Detected'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        {anomaly.message || anomaly.description || 'Anomalous pattern detected'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                    <Chip
                      label={anomalyType}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '0.7rem',
                        backgroundColor: `${color}15`,
                        color: color,
                        fontWeight: 500,
                        border: `1px solid ${color}30`,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', ml: 'auto' }}>
                      {new Date(anomaly.timestamp || anomaly.created_at || Date.now()).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
