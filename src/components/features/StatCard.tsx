import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'gold' | 'blue' | 'success' | 'warning' | 'plain';
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  icon,
  variant = 'gold',
  subtitle,
}: StatCardProps) {
  const { colors, isDark } = useTheme();

  const isBlue = variant === 'blue';
  const isSuccess = variant === 'success';
  const isWarning = variant === 'warning';

  const borderColor = isBlue
    ? colors.blueBorder
    : isSuccess
    ? colors.successBorder
    : isWarning
    ? colors.warningBorder
    : colors.goldBorder;

  const gradientColors = isDark
    ? isBlue
      ? (['rgba(0, 102, 255, 0.16)', 'rgba(0, 102, 255, 0.04)'] as const)
      : isSuccess
      ? (['rgba(34, 197, 94, 0.16)', 'rgba(34, 197, 94, 0.04)'] as const)
      : isWarning
      ? (['rgba(245, 158, 11, 0.16)', 'rgba(245, 158, 11, 0.04)'] as const)
      : (['rgba(239, 161, 0, 0.16)', 'rgba(239, 161, 0, 0.04)'] as const)
    : isBlue
    ? (['#FFFFFF', '#F0F5FF'] as const)
    : isSuccess
    ? (['#FFFFFF', '#F0FDF4'] as const)
    : isWarning
    ? (['#FFFFFF', '#FFFBEB'] as const)
    : (['#FFFFFF', '#FCFBF7'] as const);

  const valueColor = isBlue
    ? colors.blue
    : isSuccess
    ? colors.success
    : isWarning
    ? colors.warning
    : colors.gold;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        {
          borderColor,
          backgroundColor: colors.cardBackground,
          shadowColor: colors.shadowColor,
        },
      ]}
    >
      <View style={styles.topRow}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.textSecondary }]}>
          {title}
        </Text>
        <View style={styles.iconContainer}>{icon}</View>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.value, { color: valueColor }]}
      >
        {value}
      </Text>
      {subtitle && (
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 130,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 6,
  },
  iconContainer: {
    opacity: 0.9,
  },
  value: {
    fontSize: typography.sizes.xxl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
  },
});
