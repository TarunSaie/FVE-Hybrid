import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'gold' | 'blue';
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  icon,
  variant = 'gold',
  subtitle,
}: StatCardProps) {
  const isBlue = variant === 'blue';

  const borderColor = isBlue ? colors.blueBorder : colors.goldBorder;
  const gradientColors = isBlue
    ? (['rgba(0, 102, 255, 0.16)', 'rgba(0, 102, 255, 0.04)'] as const)
    : (['rgba(239, 161, 0, 0.16)', 'rgba(239, 161, 0, 0.04)'] as const);

  const valueColor = isBlue ? colors.blueLight : colors.gold;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor }]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.iconContainer}>{icon}</View>
      </View>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    backgroundColor: '#0E1115',
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 6,
  },
  iconContainer: {
    opacity: 0.85,
  },
  value: {
    fontSize: typography.sizes.xxl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
  },
});
