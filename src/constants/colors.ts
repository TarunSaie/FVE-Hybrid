export const darkColors = {
  // Brand Backgrounds
  background: '#050505',
  backgroundSecondary: '#0B0D11',
  cardBackground: '#111418',
  surface: '#181C22',
  surfaceLight: '#232830',
  surfaceMuted: '#14171C',

  // Aliases for layout ergonomics
  bgPrimary: '#050505',
  bgSecondary: '#0B0D11',
  bgTertiary: '#161A22',
  card: '#111418',
  borderDefault: 'rgba(255, 255, 255, 0.08)',

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
  textSecondary: '#C5CAD0',
  textMuted: '#8E959E',
  textSubtle: '#525A65',
  textDisabled: '#374151',

  // Borders & Dividers
  border: 'rgba(239, 161, 0, 0.25)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderDark: '#1E242C',

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

  // Elevation & Shadows
  cardElevated: '#161A20',
  shadowColor: '#000000',
  divider: 'rgba(255, 255, 255, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.75)',
  chipBackground: '#1A1E24',
} as const;

export const lightColors: Record<keyof typeof darkColors, string> = {
  // Brand Backgrounds (Mobile Luxury Pearl & Slate)
  background: '#F6F8FA',
  backgroundSecondary: '#EDF1F5',
  cardBackground: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceLight: '#F1F4F8',
  surfaceMuted: '#E9EEF4',

  // Aliases for layout ergonomics
  bgPrimary: '#F6F8FA',
  bgSecondary: '#EDF1F5',
  bgTertiary: '#E2E8F0',
  card: '#FFFFFF',
  borderDefault: 'rgba(15, 23, 42, 0.08)',

  // FVE Gold Tokens
  gold: '#D98200',
  goldBright: '#EFA100',
  goldDark: '#B36B00',
  goldBorder: 'rgba(217, 130, 0, 0.35)',
  goldGlow: 'rgba(217, 130, 0, 0.25)',
  goldMuted: 'rgba(239, 161, 0, 0.12)',
  goldSubtle: 'rgba(239, 161, 0, 0.06)',

  // FVE Blue Tokens
  blue: '#005CE6',
  blueLight: '#2563EB',
  blueDark: '#0047B3',
  blueBorder: 'rgba(0, 92, 230, 0.35)',
  blueMuted: 'rgba(0, 92, 230, 0.10)',

  // Text Tokens
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textDisabled: '#CBD5E1',

  // Borders & Dividers
  border: 'rgba(217, 130, 0, 0.3)',
  borderLight: 'rgba(15, 23, 42, 0.08)',
  borderDark: '#E2E8F0',

  // Semantic Status Colors
  success: '#16A34A',
  successMuted: 'rgba(22, 163, 74, 0.12)',
  successBorder: 'rgba(22, 163, 74, 0.35)',

  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.12)',
  warningBorder: 'rgba(217, 119, 6, 0.35)',

  error: '#DC2626',
  errorMuted: 'rgba(220, 38, 38, 0.12)',
  errorBorder: 'rgba(220, 38, 38, 0.35)',

  info: '#0284C7',
  infoMuted: 'rgba(2, 132, 199, 0.12)',
  infoBorder: 'rgba(2, 132, 199, 0.35)',

  // Role Badge Colors
  roleOwner: '#D98200',
  roleAdmin: '#2563EB',
  roleReceptionist: '#16A34A',
  roleTrainer: '#9333EA',
  roleScanner: '#0891B2',

  // Elevation & Shadows
  cardElevated: '#FFFFFF',
  shadowColor: 'rgba(15, 23, 42, 0.12)',
  divider: 'rgba(15, 23, 42, 0.06)',
  overlay: 'rgba(15, 23, 42, 0.55)',
  chipBackground: '#EEF2F6',
};

export type ThemeColors = typeof darkColors;
export type ColorToken = keyof ThemeColors;

// Default exported colors object for backward compatibility
export const colors: ThemeColors = darkColors;

export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark ? darkColors : (lightColors as ThemeColors);
}
