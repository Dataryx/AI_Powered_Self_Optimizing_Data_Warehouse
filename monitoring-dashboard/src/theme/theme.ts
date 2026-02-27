/**
 * MUI theme factory – light and dark mode.
 */

import { createTheme, PaletteMode } from '@mui/material';
import { colors, colorsDark } from './colors';

export function getTheme(mode: PaletteMode) {
  const c = mode === 'dark' ? colorsDark : colors;
  return createTheme({
    palette: {
      mode,
      primary: {
        main: c.primary,
        light: c.primaryLight,
        dark: c.primaryDark,
      },
      secondary: {
        main: c.accent,
        light: c.accentLight,
        dark: '#4a3d62',
      },
      success: { main: c.success, light: c.successLight },
      warning: { main: c.warning, light: c.warningLight },
      error: { main: c.error, light: c.errorLight },
      background: {
        default: c.background,
        paper: c.paper,
      },
      text: {
        primary: c.text,
        secondary: c.textSecondary,
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 700, letterSpacing: '-0.01em' },
      h4: { fontWeight: 600, letterSpacing: '-0.01em' },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 16 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            ...(mode === 'dark'
              ? { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2), 0 10px 15px -3px rgba(0,0,0,0.15)' }
              : { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)' }),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 12, padding: '10px 24px' },
        },
      },
    },
  });
}
