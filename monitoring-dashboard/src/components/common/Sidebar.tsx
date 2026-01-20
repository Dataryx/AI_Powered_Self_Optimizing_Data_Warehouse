/**
 * Sidebar Component
 * Premium navigation menu with smooth animations
 */

import React, { useState } from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import TuneIcon from '@mui/icons-material/Tune';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import MonitorIcon from '@mui/icons-material/Monitor';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import TableChartIcon from '@mui/icons-material/TableChart';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', color: '#6366f1' },
  { text: 'Monitoring', icon: <MonitorIcon />, path: '/monitoring', color: '#6366f1' },
  { text: 'Storage & Resources', icon: <CloudQueueIcon />, path: '/storage', color: '#10b981' },
  { text: 'Data Explorer', icon: <TableChartIcon />, path: '/data', color: '#8b5cf6' },
  { text: 'Optimizations', icon: <TuneIcon />, path: '/optimizations', color: '#ec4899' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics', color: '#f59e0b' },
  { text: 'Alerts', icon: <NotificationsIcon />, path: '/alerts', color: '#ef4444' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings', color: '#64748b' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderRight: '1px solid rgba(99, 102, 241, 0.1)',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.02)',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ px: 2, py: 2, mb: 2 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500, display: 'block', mb: 0.5 }}>
            Data Warehouse
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            Monitoring System
          </Typography>
        </Box>
      </Box>
      <List sx={{ px: 1.5 }}>
        {menuItems.map((item) => {
          const isSelected = location.pathname === item.path;
          const isHovered = hoveredItem === item.text;

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onMouseEnter={() => setHoveredItem(item.text)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={(e) => {
                  e.preventDefault();
                  if (location.pathname !== item.path) {
                    navigate(item.path, { replace: false });
                  }
                }}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}80 100%)`,
                    transform: isSelected || isHovered ? 'scaleY(1)' : 'scaleY(0)',
                    transformOrigin: 'center',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  },
                  backgroundColor: isSelected ? `${item.color}10` : 'transparent',
                  '&:hover': {
                    backgroundColor: `${item.color}08`,
                    transform: 'translateX(4px)',
                    boxShadow: `0 2px 8px ${item.color}20`,
                  },
                  '& .Mui-selected': {
                    backgroundColor: `${item.color}10`,
                    '&:hover': {
                      backgroundColor: `${item.color}15`,
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isSelected || isHovered ? item.color : 'text.secondary',
                    transition: 'all 0.3s',
                    minWidth: 40,
                    transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isSelected ? 700 : 600,
                    fontSize: '0.95rem',
                    color: isSelected || isHovered ? item.color : 'text.primary',
                    transition: 'all 0.3s',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

