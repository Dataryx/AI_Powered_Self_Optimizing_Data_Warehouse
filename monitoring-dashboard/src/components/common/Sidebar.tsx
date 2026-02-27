/**
 * Sidebar – modern dark rail with grouped nav and pill active states.
 * Non-generic: dark slate rail, section labels, collapse to icon-only.
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
  alpha,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import MonitorIcon from '@mui/icons-material/Monitor';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import TableChartIcon from '@mui/icons-material/TableChart';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import { useThemeColors } from '../../theme/useThemeColors';

const DRAWER_WIDTH = 260;
const RAIL_WIDTH = 72;

const SECTIONS = [
  {
    label: 'Overview',
    items: [
      { text: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
    ],
  },
  {
    label: 'Data & Ops',
    items: [
      { text: 'Monitoring', icon: MonitorIcon, path: '/monitoring' },
      { text: 'Storage', icon: CloudQueueIcon, path: '/storage' },
      { text: 'Data Explorer', icon: TableChartIcon, path: '/data' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { text: 'Optimizations', icon: TuneIcon, path: '/optimizations' },
      { text: 'Analytics', icon: AnalyticsIcon, path: '/analytics' },
      { text: 'Alerts', icon: NotificationsIcon, path: '/alerts' },
    ],
  },
  {
    label: 'System',
    items: [
      { text: 'Settings', icon: SettingsIcon, path: '/settings' },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open: controlledOpen, onToggle }) => {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const location = useLocation();
  const [internalOpen, setInternalOpen] = useState(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOpen !== undefined ? (onToggle || (() => {})) : setInternalOpen;

  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null && controlledOpen === undefined) setInternalOpen(saved === 'true');
  }, [controlledOpen]);

  useEffect(() => {
    if (controlledOpen === undefined) localStorage.setItem('sidebarOpen', String(internalOpen));
  }, [internalOpen, controlledOpen]);

  const handleToggle = () => {
    if (controlledOpen !== undefined) onToggle?.();
    else setInternalOpen((p) => !p);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isOpen ? DRAWER_WIDTH : RAIL_WIDTH,
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'fixed',
        height: '100vh',
        '& .MuiDrawer-paper': {
          width: isOpen ? DRAWER_WIDTH : RAIL_WIDTH,
          boxSizing: 'border-box',
          borderRight: 'none',
          background: 'linear-gradient(180deg, #151b23 0%, #1a202c 50%, #151b23 100%)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          overflowY: 'auto',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: (theme) => theme.zIndex.drawer,
        },
      }}
    >
      {/* Brand + toggle */}
      <Toolbar
        sx={{
          minHeight: { xs: 64, sm: 64 },
          px: isOpen ? 2 : 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? 'space-between' : 'center',
          borderBottom: `1px solid ${alpha('#fff', 0.06)}`,
        }}
      >
        {isOpen && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${alpha(colors.primary, 0.35)}`,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', letterSpacing: '-0.04em' }}>
                DW
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: alpha('#fff', 0.92),
                letterSpacing: '-0.02em',
                fontSize: '0.8rem',
              }}
            >
              Monitor
            </Typography>
          </Box>
        )}
        <Tooltip title={isOpen ? 'Collapse' : 'Expand'} placement="right" arrow>
          <IconButton
            onClick={handleToggle}
            sx={{
              color: alpha('#fff', 0.5),
              '&:hover': {
                color: '#fff',
                backgroundColor: alpha('#fff', 0.08),
              },
              transition: 'all 0.2s',
            }}
          >
            {isOpen ? <ChevronLeftIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      <List sx={{ px: isOpen ? 1.5 : 1, py: 2 }}>
        {SECTIONS.map((section) => (
          <Box key={section.label} sx={{ mb: 2.5 }}>
            {isOpen && (
              <Typography
                variant="caption"
                sx={{
                  px: 1.5,
                  py: 0.5,
                  display: 'block',
                  color: alpha('#fff', 0.35),
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {section.label}
              </Typography>
            )}
            {section.items.map((item) => {
              const isSelected = location.pathname === item.path;
              const isHovered = hoveredKey === item.path;
              const IconComponent = item.icon;
              return (
                <ListItem key={item.path} disablePadding sx={{ mt: 0.5 }}>
                  <Tooltip title={!isOpen ? item.text : ''} placement="right" arrow>
                    <ListItemButton
                      onMouseEnter={() => setHoveredKey(item.path)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => location.pathname !== item.path && navigate(item.path)}
                      sx={{
                        borderRadius: 2,
                        py: 1.1,
                        px: isOpen ? 1.5 : 1.25,
                        justifyContent: isOpen ? 'flex-start' : 'center',
                        minHeight: 44,
                        backgroundColor: isSelected ? alpha(colors.primary, 0.22) : 'transparent',
                        border: isSelected ? `1px solid ${alpha(colors.primary, 0.4)}` : '1px solid transparent',
                        color: isSelected ? '#fff' : alpha('#fff', 0.7),
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: isSelected ? alpha(colors.primary, 0.28) : alpha('#fff', 0.06),
                          color: '#fff',
                          borderColor: isSelected ? alpha(colors.primary, 0.5) : alpha('#fff', 0.1),
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: isOpen ? 36 : 'auto',
                          justifyContent: 'center',
                          color: 'inherit',
                        }}
                      >
                        <IconComponent sx={{ fontSize: 20 }} />
                      </ListItemIcon>
                      {isOpen && (
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{
                            fontWeight: isSelected ? 600 : 500,
                            fontSize: '0.8125rem',
                            letterSpacing: '-0.01em',
                          }}
                          sx={{ ml: 1.25 }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              );
            })}
          </Box>
        ))}
      </List>
    </Drawer>
  );
};
