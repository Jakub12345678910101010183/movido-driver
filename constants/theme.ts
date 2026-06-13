// Movido Driver — Theme Constants
// Matches exactly the main Movido web app color palette

export const Colors = {
  // Backgrounds
  background:   '#0a0a0f',
  surface:      '#111118',
  surfaceHigh:  '#16161e',
  card:         '#12121a',
  overlay:      'rgba(0,0,0,0.85)',

  // Borders
  border:       '#1e1e2a',
  borderLight:  '#252535',

  // Primary — Cyan (oklch 0.85 0.18 192)
  primary:      '#00d4ff',
  primaryDim:   '#0099bb',
  primaryFaint: 'rgba(0,212,255,0.12)',

  // Text
  textPrimary:   '#e8e8f0',
  textSecondary: '#8888a0',
  textMuted:     '#55556a',

  // Status
  success:      '#22c55e',
  successFaint: 'rgba(34,197,94,0.12)',
  warning:      '#f59e0b',
  warningFaint: 'rgba(245,158,11,0.12)',
  error:        '#ef4444',
  errorFaint:   'rgba(239,68,68,0.12)',
  info:         '#3b82f6',

  // Job Status Colors
  statusInProgress: '#00d4ff',
  statusAssigned:   '#8b5cf6',
  statusPending:    '#f59e0b',
  statusCompleted:  '#22c55e',
  statusFailed:     '#ef4444',

  // White
  white: '#ffffff',
} as const;

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
} as const;

export const Radius = {
  sm:  6,
  md:  10,
  lg:  16,
  xl:  24,
  full: 999,
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  26,
  huge: 36,
} as const;

export const FontFamily = {
  mono:    'Courier New',
  regular: undefined, // system default
} as const;
