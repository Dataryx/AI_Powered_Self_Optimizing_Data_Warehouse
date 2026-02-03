/**
 * Alert Settings Component
 * Configure alert thresholds and notifications
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import { Refresh, Save, Notifications } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface AlertConfig {
  alert_type: string;
  threshold: number;
  enabled: boolean;
  severity: string;
  description?: string;
}

interface AlertSettingsProps {
  refreshKey?: number;
}

export const AlertSettings: React.FC<AlertSettingsProps> = ({ refreshKey = 0 }) => {
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await apiService.getAlertConfig();
      
      // Ensure we have an array
      let configList: AlertConfig[] = [];
      
      if (Array.isArray(data)) {
        configList = data;
      } else if (data && Array.isArray(data.config)) {
        configList = data.config;
      } else if (data && typeof data === 'object') {
        configList = (data as any).alerts || (data as any).settings || [];
      }
      
      if (!Array.isArray(configList)) {
        configList = [];
      }
      
      // Default configs if none exist
      if (configList.length === 0) {
        configList = [
          { alert_type: 'slow_query', threshold: 5.0, enabled: true, severity: 'high', description: 'Query execution time threshold (seconds)' },
          { alert_type: 'cache_hit_rate', threshold: 70.0, enabled: true, severity: 'medium', description: 'Minimum cache hit rate (%)' },
          { alert_type: 'dead_tuples', threshold: 10.0, enabled: true, severity: 'medium', description: 'Maximum dead tuple ratio (%)' },
          { alert_type: 'empty_table', threshold: 0, enabled: true, severity: 'warning', description: 'Alert on empty tables' },
          { alert_type: 'large_table', threshold: 10.0, enabled: true, severity: 'low', description: 'Large table size threshold (GB)' },
        ];
      }
      
      setConfigs(configList);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching alert config:', err);
      // Set default configs on error
      setConfigs([
        { alert_type: 'slow_query', threshold: 5.0, enabled: true, severity: 'high', description: 'Query execution time threshold (seconds)' },
        { alert_type: 'cache_hit_rate', threshold: 70.0, enabled: true, severity: 'medium', description: 'Minimum cache hit rate (%)' },
        { alert_type: 'dead_tuples', threshold: 10.0, enabled: true, severity: 'medium', description: 'Maximum dead tuple ratio (%)' },
        { alert_type: 'empty_table', threshold: 0, enabled: true, severity: 'warning', description: 'Alert on empty tables' },
        { alert_type: 'large_table', threshold: 10.0, enabled: true, severity: 'low', description: 'Large table size threshold (GB)' },
      ]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchConfig, 30000);
    return () => clearInterval(interval);
  }, [fetchConfig, refreshKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.updateAlertConfig({ config: configs });
    } catch (err) {
      console.error('Error saving alert config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (index: number) => {
    const newConfigs = [...configs];
    newConfigs[index].enabled = !newConfigs[index].enabled;
    setConfigs(newConfigs);
  };

  const handleThresholdChange = (index: number, value: number) => {
    const newConfigs = [...configs];
    newConfigs[index].threshold = value;
    setConfigs(newConfigs);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
      case 'warning':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  const formatAlertType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading alert settings...
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
              Alert Settings
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Configure alert thresholds and severity levels
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
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
            <IconButton
              onClick={fetchConfig}
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
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Settings List */}
        {Array.isArray(configs) && configs.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {configs.map((config, index) => (
              <Box
                key={config.alert_type}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: config.enabled ? 'action.hover' : 'transparent',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {formatAlertType(config.alert_type)}
                      </Typography>
                      <Chip
                        label={config.severity}
                        size="small"
                        sx={{
                          height: '20px',
                          fontSize: '0.7rem',
                          backgroundColor: getSeverityColor(config.severity),
                          color: 'white',
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                    {config.description && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        {config.description}
                      </Typography>
                    )}
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enabled}
                        onChange={() => handleToggle(index)}
                        size="small"
                      />
                    }
                    label=""
                    sx={{ m: 0, ml: 1 }}
                  />
                </Box>
                {config.enabled && (
                  <TextField
                    fullWidth
                    type="number"
                    label="Threshold"
                    value={config.threshold}
                    onChange={(e) => handleThresholdChange(index, parseFloat(e.target.value) || 0)}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No alert settings available
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
