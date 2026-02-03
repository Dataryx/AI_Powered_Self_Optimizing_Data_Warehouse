/**
 * Sidebar Component
 * Modern, collapsible navigation sidebar with unique design
 */

import React, { useState, useEffect } from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Toolbar, 
  Box, 
  Typography,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { keyframes } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import MonitorIcon from '@mui/icons-material/Monitor';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import TableChartIcon from '@mui/icons-material/TableChart';
import StorageIcon from '@mui/icons-material/Storage';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 72;

const menuItems = [
  { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard', color: '#6366f1' },
  { text: 'Monitoring', icon: MonitorIcon, path: '/monitoring', color: '#10b981' },
  { text: 'Storage & Resources', icon: CloudQueueIcon, path: '/storage', color: '#3b82f6' },
  { text: 'Data Explorer', icon: TableChartIcon, path: '/data', color: '#8b5cf6' },
  { text: 'Optimizations', icon: TuneIcon, path: '/optimizations', color: '#ec4899' },
  { text: 'Analytics', icon: AnalyticsIcon, path: '/analytics', color: '#f59e0b' },
  { text: 'Alerts', icon: NotificationsIcon, path: '/alerts', color: '#ef4444' },
  { text: 'Settings', icon: SettingsIcon, path: '/settings', color: '#64748b' },
];

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

interface SidebarProps {
  open?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open: controlledOpen, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalOpen, setInternalOpen] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOpen !== undefined 
    ? (onToggle || (() => {}))
    : setInternalOpen;

  // Persist sidebar state in localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null && controlledOpen === undefined) {
      setInternalOpen(savedState === 'true');
    }
  }, [controlledOpen]);

  useEffect(() => {
    if (controlledOpen === undefined) {
      localStorage.setItem('sidebarOpen', String(internalOpen));
    }
  }, [internalOpen, controlledOpen]);

  const handleToggle = () => {
    if (controlledOpen !== undefined) {
      onToggle?.();
    } else {
      setInternalOpen(prev => !prev);
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
        flexShrink: 0,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'fixed',
        height: '100vh',
        '& .MuiDrawer-paper': {
          width: isOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderRight: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.05)',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          overflowY: 'auto',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: (theme) => theme.zIndex.drawer,
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: isOpen 
              ? 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)'
              : 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)',
            opacity: 0.4,
            zIndex: 1,
            transition: 'opacity 0.3s ease',
          },
        },
      }}
    >
      <Toolbar 
        sx={{ 
          minHeight: '64px !important',
        }}
      />

      <List sx={{ px: isOpen ? 2 : 1, pt: 2 }}>
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
                animation: `${slideIn} 0.3s ease-out ${index * 0.03}s both`,
              }}
            >
              <Tooltip title={!isOpen ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  selected={isSelected}
                  onMouseEnter={() => setHoveredItem(item.text)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => {
                    if (location.pathname !== item.path) {
                      navigate(item.path);
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    py: 1.25,
                    px: isOpen ? 2 : 1.5,
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    minHeight: 48,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    // Active indicator bar
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: isSelected ? '3px' : '0px',
                      height: isSelected ? '60%' : '0%',
                      background: item.color,
                      borderRadius: '0 2px 2px 0',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    },
                    // Background
                    backgroundColor: isSelected 
                      ? `${item.color}08`
                      : 'transparent',
                    border: isSelected 
                      ? `1px solid ${item.color}15`
                      : '1px solid transparent',
                    '&:hover': {
                      backgroundColor: `${item.color}10`,
                      borderColor: `${item.color}20`,
                      transform: isOpen ? 'translateX(2px)' : 'scale(1.05)',
                    },
                    '& .Mui-selected': {
                      backgroundColor: `${item.color}12`,
                      '&:hover': {
                        backgroundColor: `${item.color}15`,
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isSelected ? item.color : 'text.secondary',
                      minWidth: isOpen ? 44 : 'auto',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      transform: isHovered && !isOpen ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <IconComponent sx={{ fontSize: '22px' }} />
                  </ListItemIcon>
                  {isOpen && (
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: '0.875rem',
                        color: isSelected ? item.color : 'text.primary',
                        transition: 'all 0.2s ease',
                        letterSpacing: '-0.01em',
                      }}
                      sx={{
                        ml: 1,
                        animation: `${slideIn} 0.2s ease-out`,
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};
