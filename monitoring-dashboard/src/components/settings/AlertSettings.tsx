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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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
        // If it's an object, try to extract array from common properties
        configList = (data as any).alerts || (data as any).settings || [];
      }
      
      // Ensure it's an array
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
      setLastUpdate(new Date());
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
  }, [fetchConfig, refreshKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.updateAlertConfig({ config: configs });
      setLastUpdate(new Date());
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

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading alert settings...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
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
          background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #3b82f6 100%)',
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
                background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Notifications sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Alert Settings
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Configure alert thresholds
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
            <IconButton
              onClick={fetchConfig}
              size="small"
              sx={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                '&:hover': {
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
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

        {/* Settings List */}
        <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
          {Array.isArray(configs) && configs.length > 0 ? configs.map((config, index) => (
            <Box key={config.alert_type}>
              <Box sx={{ p: 1.25, mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {config.alert_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Typography>
                      <Chip
                        label={config.severity}
                        size="small"
                        sx={{
                          height: '16px',
                          fontSize: '0.65rem',
                          backgroundColor: getSeverityColor(config.severity),
                          color: 'white',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                    {config.description && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
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
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#6366f1',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#6366f1',
                          },
                        }}
                      />
                    }
                    label=""
                    sx={{ m: 0 }}
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.8rem',
                        height: '32px',
                      },
                    }}
                  />
                )}
              </Box>
              {index < configs.length - 1 && <Divider sx={{ my: 0.5 }} />}
            </Box>
          )) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No alert settings available
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

