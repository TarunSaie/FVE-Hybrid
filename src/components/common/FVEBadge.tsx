import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { getMembershipStatusStyle } from '@/utils/format';
import { ROLE_BADGE_STYLES, ROLE_DISPLAY_NAMES } from '@/constants/permissions';
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
  let text = label || '';
  let bg = bgColor || 'rgba(255, 255, 255, 0.08)';
  let textColor = color || '#FFFFFF';
  let border = borderColor || 'transparent';

  if (status) {
    const s = getMembershipStatusStyle(status);
    text = s.label;
    bg = s.bg;
    textColor = s.text;
    border = s.border;
  } else if (role && (role as UserRole) in ROLE_BADGE_STYLES) {
    const r = ROLE_BADGE_STYLES[role as UserRole];
    text = ROLE_DISPLAY_NAMES[role as UserRole] || role;
    bg = r.bg;
    textColor = r.text;
    border = r.border;
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
