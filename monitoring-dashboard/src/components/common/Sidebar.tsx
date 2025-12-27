import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import {
  Dashboard,
  TrendingUp,
  Analytics,
  Notifications,
  Settings,
} from '@mui/icons-material';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Optimizations', icon: <TrendingUp />, path: '/optimizations' },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  { text: 'Alerts', icon: <Notifications />, path: '/alerts' },
  { text: 'Settings', icon: <Settings />, path: '/settings' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'rgba(10, 10, 15, 0.95)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
        },
      }}
    >
      <Box sx={{ p: 3, mt: 8 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            mb: 3,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
            SYSTEM STATUS
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Operational
          </Typography>
          <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
            All systems normal
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(99, 102, 241, 0.2)', mb: 2 }} />
      </Box>
      <List sx={{ px: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(236, 72, 153, 0.2) 100%)'
                    : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    transform: 'translateX(4px)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: isActive ? '#818cf8' : 'text.secondary',
                    minWidth: 40,
                  },
                  '& .MuiListItemText-primary': {
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#f1f5f9' : 'text.secondary',
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

