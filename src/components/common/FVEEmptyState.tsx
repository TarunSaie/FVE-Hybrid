import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FVEButton } from './FVEButton';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface FVEEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function FVEEmptyState({
  icon,
  title,
  description,
  actionTitle,
  onAction,
}: FVEEmptyStateProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionTitle && onAction && (
        <FVEButton
          title={actionTitle}
          onPress={onAction}
          variant="gold"
          size="sm"
          style={styles.button}
        />
      )}
    </View>
  );
}

export const EmptyState = FVEEmptyState;

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingVertical: 36,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 16,
      marginVertical: 12,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.08)' : 'rgba(217, 130, 0, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    description: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.inter,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 20,
      maxWidth: 300,
    },
    button: {
      marginTop: 18,
    },
  });

