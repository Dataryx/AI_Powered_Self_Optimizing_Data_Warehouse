/**
 * System Settings Component
 * Configure system-wide settings
 */

import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import { Refresh, Save, Storage, Speed, Security } from '@mui/icons-material';

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

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    setTimeout(() => {
      setSaving(false);
    }, 1000);
  };

  const handleToggle = (field: string) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field as keyof typeof prev] }));
  };

  const settingItems = [
    { key: 'autoOptimization', label: 'Auto Optimization', description: 'Automatically apply optimization recommendations', icon: Speed },
    { key: 'cacheEnabled', label: 'Cache Enabled', description: 'Enable query result caching', icon: Storage },
    { key: 'compressionEnabled', label: 'Compression Enabled', description: 'Enable data compression', icon: Storage },
    { key: 'loggingEnabled', label: 'Logging Enabled', description: 'Enable system logging', icon: Security },
    { key: 'performanceTracking', label: 'Performance Tracking', description: 'Track query performance metrics', icon: Speed },
  ];

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
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
          background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #6366f1 100%)',
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
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Security sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                System Settings
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Configure system-wide options
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

        {/* Settings List */}
        <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
          {settingItems.map((item, index) => {
            const Icon = item.icon;
            const isEnabled = settings[item.key as keyof typeof settings] as boolean;

            return (
              <Box key={item.key}>
                <Box sx={{ p: 1.25, mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Icon sx={{ fontSize: 18, color: isEnabled ? '#10b981' : '#64748b' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
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
                </Box>
                {index < settingItems.length - 1 && <Divider sx={{ my: 0.5 }} />}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

