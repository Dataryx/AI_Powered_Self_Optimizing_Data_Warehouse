/**
 * Returns the current palette (light or dark) so all components match the active mode.
 */

import { useColorMode } from '../contexts/ColorModeContext';
import { colors } from './colors';
import { colorsDark } from './colors';

export function useThemeColors(): typeof colors {
  const { mode } = useColorMode();
  return mode === 'dark' ? colorsDark : colors;
}
