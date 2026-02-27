/**
 * Placeholder Content Component
 * Displays placeholder content when API is unavailable
 * Note: This component is now primarily for loading states.
 * For offline mode, components should use mockDataService instead.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Skeleton,
  Stack,
  Alert,
  AlertTitle,
} from '@mui/material';
import { useThemeColors } from '../../theme/useThemeColors';
import {
  CloudOff,
  BarChart,
  TrendingUp,
  Assessment,
  People,
  ShoppingCart,
} from '@mui/icons-material';

interface PlaceholderContentProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  variant?: 'card' | 'chart' | 'list' | 'table' | 'stats';
  height?: string | number;
}

export const PlaceholderContent: React.FC<PlaceholderContentProps> = ({
  title,
  description,
  icon,
  variant = 'card',
  height,
}) => {
  const colors = useThemeColors();
  const defaultIcon = <CloudOff sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />;
  const displayIcon = icon || defaultIcon;

  const defaultTitle = title || 'API Unavailable';
  const defaultDescription =
    description ||
    'The API server is not running. Please start the API server to view live data.';

  // Chart placeholder
  if (variant === 'chart') {
    return (
      <Paper
        sx={{
          p: 3,
          height: height || 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 100%)`,
          border: `1px dashed ${colors.border}`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ mb: 2, opacity: 0.6 }}>{displayIcon}</Box>
        <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
          {defaultTitle}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 300 }}>
          {defaultDescription}
        </Typography>
        {/* Skeleton chart */}
        <Box sx={{ width: '100%', mt: 3, opacity: 0.3 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
        </Box>
      </Paper>
    );
  }

  // Stats placeholder
  if (variant === 'stats') {
    return (
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map((i) => (
          <Paper
            key={i}
            sx={{
              p: 2,
              flex: 1,
              minWidth: 200,
              background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 100%)`,
              border: `1px dashed ${colors.border}`,
              borderRadius: 2,
            }}
          >
            <Stack spacing={1}>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={32} />
              <Skeleton variant="text" width="80%" height={16} />
            </Stack>
          </Paper>
        ))}
      </Box>
    );
  }

  // List placeholder
  if (variant === 'list') {
    return (
      <Paper
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 100%)`,
          border: `1px dashed ${colors.border}`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ opacity: 0.6 }}>{displayIcon}</Box>
          <Box>
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {defaultTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {defaultDescription}
            </Typography>
          </Box>
        </Box>
        <Stack spacing={1}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      </Paper>
    );
  }

  // Table placeholder
  if (variant === 'table') {
    return (
      <Paper
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 100%)`,
          border: `1px dashed ${colors.border}`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ opacity: 0.6 }}>{displayIcon}</Box>
          <Box>
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {defaultTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {defaultDescription}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ opacity: 0.3 }}>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" height={50} sx={{ mb: 1, borderRadius: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  // Default card placeholder
  return (
    <Paper
      sx={{
        p: 4,
        height: height || 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 100%)`,
        border: `1px dashed ${colors.border}`,
        borderRadius: 2,
        textAlign: 'center',
      }}
    >
      <Box sx={{ mb: 2, opacity: 0.6 }}>{displayIcon}</Box>
      <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
        {defaultTitle}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 400 }}>
        {defaultDescription}
      </Typography>
    </Paper>
  );
};

/**
 * Conditional Render Component
 * Renders children when API is online, placeholder when offline
 */
interface ConditionalRenderProps {
  isOnline: boolean;
  isLoading?: boolean;
  placeholder?: React.ReactNode;
  placeholderProps?: Omit<PlaceholderContentProps, 'title' | 'description'>;
  children: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  isOnline,
  isLoading = false,
  placeholder,
  placeholderProps,
  children,
}) => {
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={200} />
          <Skeleton variant="rectangular" height={200} />
        </Stack>
      </Box>
    );
  }

  if (!isOnline) {
    if (placeholder) {
      return <>{placeholder}</>;
    }
    return <PlaceholderContent {...placeholderProps} />;
  }

  return <>{children}</>;
};

