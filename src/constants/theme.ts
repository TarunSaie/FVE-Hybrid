import { darkColors, lightColors, ThemeColors, ColorToken, getThemeColors, colors } from './colors';
import { typography } from './typography';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const layout = {
  minTouchTarget: 44,
  screenPaddingHorizontal: 16,
  headerHeight: 56,
  tabBarHeight: 60,
  cardRadius: 16,
  buttonRadius: 14,
  inputRadius: 12,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const theme = {
  spacing,
  radii,
  typography,
  layout,
  shadows,
  colors,
} as const;

export {
  darkColors,
  lightColors,
  getThemeColors,
  colors,
  typography,
};

export type { ThemeColors, ColorToken };
