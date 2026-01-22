/**
 * Monitoring Settings Component
 * Configure monitoring intervals and data retention
 */

import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
} from '@mui/material';
import { Refresh, Save, Settings } from '@mui/icons-material';

interface MonitoringSettingsProps {
  refreshKey?: number;
}

export const MonitoringSettings: React.FC<MonitoringSettingsProps> = ({ refreshKey = 0 }) => {
  const [settings, setSettings] = useState({
    refreshInterval: 30,
    dataRetentionDays: 90,
    metricsInterval: '1h',
    alertCheckInterval: 60,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    setTimeout(() => {
      setSaving(false);
    }, 1000);
  };

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
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
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Monitoring Settings
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Configure monitoring intervals
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<Save sx={{ fontSize: 14 }} />}
              onClick={handleSave}
              disabled={saving}
              sx={{
                backgroundColor: '#6366f1',
                color: 'white',
                fontSize: '0.7rem',
                px: 1.5,
                py: 0.5,
                minWidth: 'auto',
                height: '28px',
                '&:hover': {
                  backgroundColor: '#4f46e5',
                },
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>

        {/* Settings Form */}
        <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              fullWidth
              type="number"
              label="Dashboard Refresh Interval (seconds)"
              value={settings.refreshInterval}
              onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value) || 30)}
              size="small"
              helperText="How often the dashboard refreshes data"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8rem',
                },
              }}
            />

            <TextField
              fullWidth
              type="number"
              label="Data Retention (days)"
              value={settings.dataRetentionDays}
              onChange={(e) => handleChange('dataRetentionDays', parseInt(e.target.value) || 90)}
              size="small"
              helperText="How long to keep historical data"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8rem',
                },
              }}
            />

            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: '0.8rem' }}>Metrics Aggregation Interval</InputLabel>
              <Select
                value={settings.metricsInterval}
                label="Metrics Aggregation Interval"
                onChange={(e) => handleChange('metricsInterval', e.target.value)}
                sx={{ fontSize: '0.8rem' }}
              >
                <MenuItem value="1m">1 minute</MenuItem>
                <MenuItem value="5m">5 minutes</MenuItem>
                <MenuItem value="15m">15 minutes</MenuItem>
                <MenuItem value="1h">1 hour</MenuItem>
                <MenuItem value="1d">1 day</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Alert Check Interval (seconds)"
              value={settings.alertCheckInterval}
              onChange={(e) => handleChange('alertCheckInterval', parseInt(e.target.value) || 60)}
              size="small"
              helperText="How often to check for new alerts"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8rem',
                },
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

