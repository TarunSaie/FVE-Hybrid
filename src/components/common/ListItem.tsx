import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

export interface ListItemProps {
  title: string;
  subtitle?: string | React.ReactNode;
  caption?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  destructive?: boolean;
  badge?: React.ReactNode;
  accessibilityLabel?: string;
  bottomDivider?: boolean;
}

export function ListItem({
  title,
  subtitle,
  caption,
  leftIcon,
  rightElement,
  showChevron = false,
  onPress,
  style,
  disabled = false,
  destructive = false,
  badge,
  accessibilityLabel,
  bottomDivider = true,
}: ListItemProps) {
  const { colors, isDark } = useTheme();
  const isPressable = typeof onPress === 'function' && !disabled;

  const handlePress = () => {
    if (!isPressable || !onPress) return;
    haptics.selection();
    onPress();
  };

  const titleColor = destructive
    ? colors.error
    : disabled
    ? colors.textDisabled
    : colors.textPrimary;

  const content = (
    <View
      style={[
        styles.row,
        bottomDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderDark,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {leftIcon && (
        <View style={[styles.leftContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }]}>
          {leftIcon}
        </View>
      )}

      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: titleColor },
            ]}
          >
            {title}
          </Text>
          {badge && <View style={styles.badgeWrap}>{badge}</View>}
        </View>

        {typeof subtitle === 'string' ? (
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}

        {caption && (
          <Text
            numberOfLines={1}
            style={[styles.caption, { color: colors.textMuted }]}
          >
            {caption}
          </Text>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightElement}
        {showChevron && (
          <ChevronRight
            size={18}
            color={colors.textMuted}
            style={styles.chevron}
          />
        )}
      </View>
    </View>
  );

  if (isPressable) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        android_ripple={{
          color: isDark ? 'rgba(239, 161, 0, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        }}
        style={({ pressed }) => [
          styles.pressableWrapper,
          pressed && Platform.OS === 'ios' && { opacity: 0.7 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  pressableWrapper: {
    minHeight: 48,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  leftContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
    lineHeight: 18,
  },
  caption: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  badgeWrap: {
    marginLeft: 6,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  chevron: {
    marginLeft: 6,
  },
  disabled: {
    opacity: 0.45,
  },
});
