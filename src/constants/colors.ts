export const colors = {
  // Brand Backgrounds
  background: '#050505',
  backgroundSecondary: '#0A0A0A',
  cardBackground: '#111111',
  surface: '#1A1D21',
  surfaceLight: '#24282E',

  // FVE Gold Tokens
  gold: '#EFA100',
  goldBright: '#FDBD11',
  goldDark: '#C78500',
  goldBorder: 'rgba(239, 161, 0, 0.35)',
  goldGlow: 'rgba(239, 161, 0, 0.4)',
  goldMuted: 'rgba(239, 161, 0, 0.12)',
  goldSubtle: 'rgba(239, 161, 0, 0.06)',

  // FVE Blue Tokens
  blue: '#0066FF',
  blueLight: '#3B82F6',
  blueDark: '#003B99',
  blueBorder: 'rgba(0, 102, 255, 0.4)',
  blueMuted: 'rgba(0, 102, 255, 0.12)',

  // Text Tokens
  textPrimary: '#FFFFFF',
  textSecondary: '#BFC3C7',
  textMuted: '#8E9296',
  textSubtle: '#4B5563',
  textDisabled: '#374151',

  // Borders & Dividers
  border: 'rgba(239, 161, 0, 0.25)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderDark: '#1E232A',

  // Semantic Status Colors
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  successBorder: 'rgba(34, 197, 94, 0.35)',

  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  warningBorder: 'rgba(245, 158, 11, 0.35)',

  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  errorBorder: 'rgba(239, 68, 68, 0.35)',

  info: '#38BDF8',
  infoMuted: 'rgba(56, 189, 248, 0.15)',
  infoBorder: 'rgba(56, 189, 248, 0.35)',

  // Role Badge Colors
  roleOwner: '#EFA100',
  roleAdmin: '#3B82F6',
  roleReceptionist: '#22C55E',
  roleTrainer: '#A855F7',
  roleScanner: '#06B6D4',
} as const;

export type ColorToken = keyof typeof colors;
