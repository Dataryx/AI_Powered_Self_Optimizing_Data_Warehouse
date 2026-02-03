/**
 * System Settings Component
 * Configure system-wide settings and preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Switch,
  FormControlLabel,
  Button,
  Divider,
} from '@mui/material';
import { Save, Storage, Speed, Security, AutoAwesome } from '@mui/icons-material';

interface SystemSettingsProps {
  refreshKey?: number;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ refreshKey = 0 }) => {
  const [settings, setSettings] = useState({
    autoOptimization: true,
    cacheEnabled: true,
    compressionEnabled: true,
    loggingEnabled: true,
    performanceTracking: true,
  });
  const [saving, setSaving] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch settings from backend (if API exists) or use defaults
  const fetchSettings = useCallback(async () => {
    try {
      // TODO: Add API endpoint for system settings if available
      // const data = await apiService.getSystemSettings();
      // if (data) setSettings(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching system settings:', err);
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
      // TODO: Add API endpoint for saving system settings if available
      // await apiService.updateSystemSettings(settings);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error saving system settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field: string) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field as keyof typeof prev] }));
  };

  const settingItems = [
    { 
      key: 'autoOptimization', 
      label: 'Auto Optimization', 
      description: 'Automatically apply optimization recommendations', 
      icon: AutoAwesome,
      category: 'Optimization'
    },
    { 
      key: 'cacheEnabled', 
      label: 'Query Result Caching', 
      description: 'Enable query result caching for improved performance', 
      icon: Storage,
      category: 'Performance'
    },
    { 
      key: 'compressionEnabled', 
      label: 'Data Compression', 
      description: 'Enable data compression to reduce storage costs', 
      icon: Storage,
      category: 'Storage'
    },
    { 
      key: 'loggingEnabled', 
      label: 'System Logging', 
      description: 'Enable comprehensive system logging and audit trails', 
      icon: Security,
      category: 'Security'
    },
    { 
      key: 'performanceTracking', 
      label: 'Performance Tracking', 
      description: 'Track query performance metrics and analytics', 
      icon: Speed,
      category: 'Monitoring'
    },
  ];

  // Group settings by category
  const groupedSettings = settingItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof settingItems>);

  return (
    <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
              System Settings
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Configure system-wide options and preferences
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

        {/* Settings List - Grouped by Category */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Object.entries(groupedSettings).map(([category, items], categoryIndex) => (
            <Box key={category}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.875rem', 
                  color: 'text.secondary',
                  mb: 1.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {category}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {items.map((item, index) => {
                  const Icon = item.icon;
                  const isEnabled = settings[item.key as keyof typeof settings] as boolean;

                  return (
                    <Box
                      key={item.key}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: isEnabled ? 'action.hover' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <Icon 
                          sx={{ 
                            fontSize: 20, 
                            color: isEnabled ? 'primary.main' : 'text.disabled' 
                          }} 
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.25 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                            {item.description}
                          </Typography>
                        </Box>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEnabled}
                            onChange={() => handleToggle(item.key)}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ m: 0, ml: 2 }}
                      />
                    </Box>
                  );
                })}
              </Box>
              {categoryIndex < Object.keys(groupedSettings).length - 1 && (
                <Divider sx={{ mt: 3 }} />
              )}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};
