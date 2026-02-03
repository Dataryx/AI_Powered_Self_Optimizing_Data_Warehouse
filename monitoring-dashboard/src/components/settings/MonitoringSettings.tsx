/**
 * Monitoring Settings Component
 * Configure monitoring intervals and data retention
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch settings from backend (if API exists) or use defaults
  const fetchSettings = useCallback(async () => {
    try {
      // TODO: Add API endpoint for monitoring settings if available
      // const data = await apiService.getMonitoringSettings();
      // if (data) setSettings(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching monitoring settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchSettings, 30000);
    return () => clearInterval(interval);
  }, [fetchSettings, refreshKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Add API endpoint for saving monitoring settings if available
      // await apiService.updateMonitoringSettings(settings);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error saving monitoring settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
              Monitoring Settings
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Configure monitoring intervals and data retention
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            startIcon={<Save fontSize="small" />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              fontSize: '0.75rem',
              px: 1.5,
              py: 0.5,
              minWidth: 'auto',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, mt: 2 }} />

        {/* Settings Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            type="number"
            label="Dashboard Refresh Interval"
            value={settings.refreshInterval}
            onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value) || 30)}
            size="small"
            helperText="How often the dashboard refreshes data (seconds)"
            InputProps={{
              endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>sec</Typography>,
            }}
          />

          <TextField
            fullWidth
            type="number"
            label="Data Retention"
            value={settings.dataRetentionDays}
            onChange={(e) => handleChange('dataRetentionDays', parseInt(e.target.value) || 90)}
            size="small"
            helperText="How long to keep historical data"
            InputProps={{
              endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>days</Typography>,
            }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Metrics Aggregation Interval</InputLabel>
            <Select
              value={settings.metricsInterval}
              label="Metrics Aggregation Interval"
              onChange={(e) => handleChange('metricsInterval', e.target.value)}
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
            label="Alert Check Interval"
            value={settings.alertCheckInterval}
            onChange={(e) => handleChange('alertCheckInterval', parseInt(e.target.value) || 60)}
            size="small"
            helperText="How often to check for new alerts"
            InputProps={{
              endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>sec</Typography>,
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};
