/**
 * Human, non-generic color palette for dashboards.
 * Earthy, readable tones: steel teal, forest, rust, brick, warm grays.
 */

export const colors = {
  // Primary – steel teal (deep water / aged metal)
  primary: '#1e5f74',
  primaryLight: '#2d7d8a',
  primaryDark: '#164552',

  // Success – forest green
  success: '#2d6a4f',
  successLight: '#d4e8dc',

  // Warning – amber / rust
  warning: '#b45309',
  warningLight: '#fef3c7',

  // Error – brick red
  error: '#b91c1c',
  errorLight: '#fef2f2',

  // Text
  text: '#1a202c',
  textSecondary: '#5a6578',
  textMuted: '#718096',

  // Accent – dusty plum (replaces generic purple/indigo)
  accent: '#5c4d7a',
  accentLight: '#e8e4ec',

  // Neutrals
  border: '#e2e5e9',
  borderLight: '#edf0f2',
  background: '#f7f6f4',
  paper: '#ffffff',

  // Chart / data – earthy, distinct
  chart: [
    '#4a7c8b', // dusty blue
    '#6b7c5c', // sage
    '#b85c38', // terracotta
    '#c49a2a', // ochre
    '#a0676b', // dusty rose
    '#5c6b7a', // slate
  ],

  // Layer colors (Bronze / Silver / Gold) – still semantic, less neon
  layerBronze: { bg: '#fef3c7', text: '#92400e', border: '#b45309', accent: '#b45309' },
  layerSilver: { bg: '#e8e4ec', text: '#5c4d7a', border: '#5c4d7a', accent: '#5c4d7a' },
  layerGold: { bg: '#d4e8dc', text: '#2d6a4f', border: '#2d6a4f', accent: '#2d6a4f' },
} as const;

/** Dark mode palette – same semantics, dark surfaces and light text */
export const colorsDark = {
  ...colors,
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  borderLight: '#1e293b',
  background: '#0f172a',
  paper: '#1e293b',
  layerBronze: { bg: '#422006', text: '#fcd34d', border: '#b45309', accent: '#f59e0b' },
  layerSilver: { bg: '#312e81', text: '#c7d2fe', border: '#6366f1', accent: '#818cf8' },
  layerGold: { bg: '#064e3b', text: '#6ee7b7', border: '#10b981', accent: '#34d399' },
} as const;
