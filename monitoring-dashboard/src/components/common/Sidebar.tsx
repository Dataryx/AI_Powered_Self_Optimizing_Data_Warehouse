/**
 * Sidebar Component
 * Professional data dashboard navigation with modern aesthetics
 */

import React, { useState, useEffect } from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { keyframes } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import TuneIcon from '@mui/icons-material/Tune';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import MonitorIcon from '@mui/icons-material/Monitor';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import TableChartIcon from '@mui/icons-material/TableChart';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
  { text: 'Monitoring', icon: MonitorIcon, path: '/monitoring', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { text: 'Storage & Resources', icon: CloudQueueIcon, path: '/storage', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  { text: 'Data Explorer', icon: TableChartIcon, path: '/data', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
  { text: 'Optimizations', icon: TuneIcon, path: '/optimizations', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
  { text: 'Analytics', icon: AnalyticsIcon, path: '/analytics', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { text: 'Alerts', icon: NotificationsIcon, path: '/alerts', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  { text: 'Settings', icon: SettingsIcon, path: '/settings', color: '#64748b', gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' },
];

// Staggered fade-in animation
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setIsLoaded(true);
  }, []);

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
          borderRight: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: 'none',
          position: 'relative',
          // Subtle gradient left border accent
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
            opacity: 0.6,
            zIndex: 1,
          },
        },
      }}
    >
      <Toolbar />
      
      {/* Rounded card-style header with gradient background */}
      <Box 
        sx={{ 
          px: 3, 
          py: 3, 
          mb: 1,
          animation: isLoaded ? `${fadeInUp} 0.5s ease-out` : 'none',
        }}
      >
        <Box
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
            backgroundSize: '200% 200%',
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.25)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%)',
              pointerEvents: 'none',
            },
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              opacity: 0.95, 
              fontWeight: 500, 
              display: 'block', 
              mb: 0.5,
              fontSize: '0.7rem',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Data Warehouse
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 700, 
              fontSize: '0.95rem',
              letterSpacing: '-0.01em',
            }}
          >
            Monitoring System
          </Typography>
        </Box>
      </Box>

      <List sx={{ px: 2, pt: 1 }}>
        {menuItems.map((item, index) => {
          const isSelected = location.pathname === item.path;
          const isHovered = hoveredItem === item.text;
          const IconComponent = item.icon;

          return (
            <ListItem 
              key={item.text} 
              disablePadding 
              sx={{ 
                mb: 0.75,
                animation: isLoaded 
                  ? `${fadeInUp} 0.5s ease-out ${index * 0.05}s both` 
                  : 'none',
              }}
            >
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
                  borderRadius: 2.5,
                  py: 1.25,
                  px: 2,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'visible',
                  // Left color bar for active/hover state
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: isSelected || isHovered ? '3px' : '0px',
                    height: isSelected || isHovered ? '60%' : '0%',
                    background: item.gradient,
                    borderRadius: '0 2px 2px 0',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: isSelected || isHovered ? 1 : 0,
                  },
                  // Light gradient background for active state
                  background: isSelected 
                    ? `linear-gradient(90deg, ${item.color}08 0%, ${item.color}04 100%)`
                    : 'transparent',
                  border: isSelected 
                    ? `1px solid ${item.color}15`
                    : '1px solid transparent',
                  '&:hover': {
                    background: `linear-gradient(90deg, ${item.color}10 0%, ${item.color}06 100%)`,
                    borderColor: `${item.color}20`,
                    transform: 'translateX(2px)',
                    boxShadow: `0 2px 8px ${item.color}15`,
                  },
                  '& .Mui-selected': {
                    background: `linear-gradient(90deg, ${item.color}12 0%, ${item.color}06 100%)`,
                    '&:hover': {
                      background: `linear-gradient(90deg, ${item.color}15 0%, ${item.color}08 100%)`,
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isSelected || isHovered ? item.color : 'text.secondary',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    minWidth: 44,
                    justifyContent: 'center',
                    transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  <IconComponent sx={{ fontSize: '22px' }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.9rem',
                    color: isSelected || isHovered ? item.color : 'text.primary',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    letterSpacing: '-0.01em',
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
