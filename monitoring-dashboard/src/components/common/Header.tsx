/**
 * Header Component
 * Top navigation bar with status indicators and user menu.
 */

import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Badge,
  Chip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  activeAlertsCount?: number;
  systemStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

export const Header: React.FC<HeaderProps> = ({
  activeAlertsCount = 0,
  systemStatus = 'healthy',
}) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <DashboardIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          Data Warehouse Monitor
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Chip
          label={systemStatus.toUpperCase()}
          color={getStatusColor(systemStatus) as any}
          size="small"
          sx={{ mr: 2 }}
        />

        <IconButton
          color="inherit"
          onClick={() => navigate('/alerts')}
          sx={{ mr: 1 }}
        >
          <Badge badgeContent={activeAlertsCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>

        <IconButton
          color="inherit"
          onClick={() => navigate('/settings')}
        >
          <SettingsIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Header;


