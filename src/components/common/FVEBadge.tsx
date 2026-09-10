import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ROLE_DISPLAY_NAMES } from '@/constants/permissions';
import { UserRole } from '@/types';
import { typography } from '@/constants/typography';

interface FVEBadgeProps {
  status?: string | null;
  role?: UserRole | string | null;
  label?: string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function FVEBadge({
  status,
  role,
  label,
  color,
  bgColor,
  borderColor,
  size = 'md',
  style,
}: FVEBadgeProps) {
  const { colors, isDark } = useTheme();

  let text = label || '';
  let bg = bgColor || (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)');
  let textColor = color || colors.textPrimary;
  let border = borderColor || 'transparent';

  if (status) {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') {
      text = 'ACTIVE';
      bg = colors.successMuted;
      textColor = colors.success;
      border = colors.successBorder;
    } else if (s === 'EXPIRING_SOON') {
      text = 'EXPIRING SOON';
      bg = colors.warningMuted;
      textColor = colors.warning;
      border = colors.warningBorder;
    } else if (s === 'EXPIRED') {
      text = 'EXPIRED';
      bg = colors.errorMuted;
      textColor = colors.error;
      border = colors.errorBorder;
    } else if (s === 'HOLD') {
      text = 'ON HOLD';
      bg = isDark ? 'rgba(156, 163, 175, 0.15)' : 'rgba(100, 116, 139, 0.12)';
      textColor = isDark ? '#9CA3AF' : '#475569';
      border = isDark ? 'rgba(156, 163, 175, 0.35)' : 'rgba(100, 116, 139, 0.3)';
    } else {
      text = status;
      bg = colors.goldMuted;
      textColor = colors.gold;
      border = colors.goldBorder;
    }
  } else if (role) {
    const r = role.toUpperCase() as UserRole;
    text = ROLE_DISPLAY_NAMES[r] || role;
    if (r === 'OWNER') {
      bg = colors.goldMuted;
      textColor = colors.roleOwner;
      border = colors.goldBorder;
    } else if (r === 'ADMIN') {
      bg = colors.blueMuted;
      textColor = colors.roleAdmin;
      border = colors.blueBorder;
    } else if (r === 'RECEPTIONIST') {
      bg = colors.successMuted;
      textColor = colors.roleReceptionist;
      border = colors.successBorder;
    } else if (r === 'TRAINER') {
      bg = isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(147, 51, 234, 0.12)';
      textColor = colors.roleTrainer;
      border = isDark ? 'rgba(168, 85, 247, 0.35)' : 'rgba(147, 51, 234, 0.3)';
    } else if (r === 'ATTENDANCE_SCANNER') {
      bg = isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(8, 145, 178, 0.12)';
      textColor = colors.roleScanner;
      border = isDark ? 'rgba(6, 182, 212, 0.35)' : 'rgba(8, 145, 178, 0.3)';
    }
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 10,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? 10 : typography.sizes.xs,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
