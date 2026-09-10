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

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.2)' : 'rgba(217, 130, 0, 0.2)',
      borderRadius: 14,
      marginVertical: 12,
    },
    iconContainer: {
      marginBottom: 14,
      opacity: 0.6,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.sizes.md,
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
      lineHeight: 18,
      maxWidth: 280,
    },
    button: {
      marginTop: 18,
    },
  });
