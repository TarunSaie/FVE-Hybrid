import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { ColorToken } from '@/constants/colors';

export type TextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'subhead'
  | 'body'
  | 'caption'
  | 'label'
  | 'metric';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'subtle'
  | 'gold'
  | 'blue'
  | 'error'
  | 'success'
  | 'warning'
  | string;

export interface FVETextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold' | 'heavy';
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function FVEText({
  variant = 'body',
  color = 'primary',
  weight,
  align,
  style,
  children,
  allowFontScaling = true,
  ...rest
}: FVETextProps) {
  const { colors } = useTheme();

  const resolveColor = (): string => {
    switch (color) {
      case 'primary':
        return colors.textPrimary;
      case 'secondary':
        return colors.textSecondary;
      case 'muted':
        return colors.textMuted;
      case 'subtle':
        return colors.textSubtle;
      case 'gold':
        return colors.gold;
      case 'blue':
        return colors.blue;
      case 'error':
        return colors.error;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      default:
        if (color in colors) {
          return colors[color as ColorToken];
        }
        return color;
    }
  };

  const getVariantStyle = (): TextStyle => {
    switch (variant) {
      case 'display':
        return {
          fontFamily: typography.fonts.orbitronBlack,
          fontSize: typography.sizes.display,
          letterSpacing: 1.2,
          lineHeight: 38,
        };
      case 'metric':
        return {
          fontFamily: typography.fonts.rajdhani,
          fontSize: typography.sizes.xxl,
          fontWeight: '700',
          letterSpacing: 0.5,
          lineHeight: 30,
        };
      case 'title':
        return {
          fontFamily: typography.fonts.rajdhani,
          fontSize: typography.sizes.xl,
          fontWeight: '700',
          letterSpacing: 0.5,
          lineHeight: 26,
        };
      case 'headline':
        return {
          fontFamily: typography.fonts.rajdhani,
          fontSize: typography.sizes.lg,
          fontWeight: '700',
          letterSpacing: 0.3,
          lineHeight: 24,
        };
      case 'subhead':
        return {
          fontFamily: typography.fonts.interSemiBold,
          fontSize: typography.sizes.base,
          fontWeight: '600',
          lineHeight: 20,
        };
      case 'label':
        return {
          fontFamily: typography.fonts.rajdhaniSemiBold,
          fontSize: typography.sizes.xs,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          lineHeight: 14,
        };
      case 'caption':
        return {
          fontFamily: typography.fonts.inter,
          fontSize: typography.sizes.xs,
          lineHeight: 16,
        };
      case 'body':
      default:
        return {
          fontFamily: typography.fonts.inter,
          fontSize: typography.sizes.base,
          lineHeight: 22,
        };
    }
  };

  const getWeightFont = (): TextStyle | null => {
    if (!weight) return null;
    switch (weight) {
      case 'regular':
        return { fontFamily: typography.fonts.inter, fontWeight: '400' };
      case 'medium':
        return { fontFamily: typography.fonts.interMedium, fontWeight: '500' };
      case 'semiBold':
        return { fontFamily: typography.fonts.interSemiBold, fontWeight: '600' };
      case 'bold':
        return { fontFamily: typography.fonts.interBold, fontWeight: '700' };
      case 'heavy':
        return { fontFamily: typography.fonts.orbitronBlack, fontWeight: '900' };
      default:
        return null;
    }
  };

  return (
    <RNText
      allowFontScaling={allowFontScaling}
      style={[
        getVariantStyle(),
        { color: resolveColor() },
        align ? { textAlign: align } : null,
        getWeightFont(),
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export const Text = FVEText;
