import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

export type ButtonVariant = 'gold' | 'blue' | 'outline' | 'ghost' | 'danger' | 'secondary';

interface FVEButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md' | 'lg';
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
}

export function FVEButton({
  title,
  onPress,
  variant = 'gold',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  size = 'md',
  haptic = 'light',
}: FVEButtonProps) {
  const { colors, isDark } = useTheme();
  const isInteractive = !disabled && !loading;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!isInteractive) return;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (!isInteractive) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (!isInteractive) return;
    if (haptic === 'medium') haptics.medium();
    else if (haptic === 'heavy') haptics.heavy();
    else if (haptic === 'selection') haptics.selection();
    else if (haptic === 'light') haptics.light();
    onPress();
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: typography.sizes.sm, minHeight: 36 },
    md: { paddingVertical: 12, paddingHorizontal: 18, fontSize: typography.sizes.base, minHeight: 46 },
    lg: { paddingVertical: 15, paddingHorizontal: 22, fontSize: typography.sizes.md, minHeight: 52 },
  }[size];

  if (variant === 'gold') {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!isInteractive}
          android_ripple={{ color: 'rgba(0, 0, 0, 0.25)', borderless: false }}
          style={[styles.base, disabled && styles.disabled]}
        >
          <LinearGradient
            colors={
              disabled
                ? isDark ? ['#3A3428', '#2A241C'] : ['#E2E8F0', '#CBD5E1']
                : [colors.goldBright, colors.gold, colors.goldDark]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.gradient,
              {
                paddingVertical: sizeStyles.paddingVertical,
                paddingHorizontal: sizeStyles.paddingHorizontal,
                minHeight: sizeStyles.minHeight,
                shadowColor: colors.gold,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#050505" />
            ) : (
              <View style={styles.contentRow}>
                {icon && iconPosition === 'left' && (
                  <View style={styles.iconLeft}>{icon}</View>
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.goldText,
                    { fontSize: sizeStyles.fontSize },
                    disabled && !isDark && { color: colors.textMuted },
                    textStyle,
                  ]}
                >
                  {title}
                </Text>
                {icon && iconPosition === 'right' && (
                  <View style={styles.iconRight}>{icon}</View>
                )}
              </View>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'blue') {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!isInteractive}
          android_ripple={{ color: 'rgba(255, 255, 255, 0.25)', borderless: false }}
          style={[styles.base, disabled && styles.disabled]}
        >
          <LinearGradient
            colors={
              disabled
                ? isDark ? ['#1A2535', '#101722'] : ['#E2E8F0', '#CBD5E1']
                : [colors.blueLight, colors.blue, colors.blueDark]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.gradient,
              {
                paddingVertical: sizeStyles.paddingVertical,
                paddingHorizontal: sizeStyles.paddingHorizontal,
                minHeight: sizeStyles.minHeight,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.contentRow}>
                {icon && iconPosition === 'left' && (
                  <View style={styles.iconLeft}>{icon}</View>
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.blueText,
                    { fontSize: sizeStyles.fontSize },
                    textStyle,
                  ]}
                >
                  {title}
                </Text>
                {icon && iconPosition === 'right' && (
                  <View style={styles.iconRight}>{icon}</View>
                )}
              </View>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'secondary') {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!isInteractive}
          android_ripple={{ color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderless: false }}
          style={[
            styles.base,
            styles.outlineBase,
            {
              backgroundColor: colors.surfaceLight,
              borderColor: colors.borderDark,
              paddingVertical: sizeStyles.paddingVertical,
              paddingHorizontal: sizeStyles.paddingHorizontal,
              minHeight: sizeStyles.minHeight,
            },
            disabled && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <View style={styles.contentRow}>
              {icon && iconPosition === 'left' && (
                <View style={styles.iconLeft}>{icon}</View>
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.outlineText,
                  { color: colors.textPrimary, fontSize: sizeStyles.fontSize },
                  textStyle,
                ]}
              >
                {title}
              </Text>
              {icon && iconPosition === 'right' && (
                <View style={styles.iconRight}>{icon}</View>
              )}
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  const outlineBorder =
    variant === 'danger' ? colors.errorBorder : colors.goldBorder;
  const outlineTextColor =
    variant === 'danger' ? colors.error : colors.gold;
  const outlineBg =
    variant === 'ghost'
      ? 'transparent'
      : isDark
      ? 'rgba(15, 17, 21, 0.7)'
      : 'rgba(255, 255, 255, 0.9)';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!isInteractive}
        android_ripple={{
          color: variant === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 161, 0, 0.18)',
          borderless: false,
        }}
        style={[
          styles.base,
          styles.outlineBase,
          {
            borderColor: variant === 'ghost' ? 'transparent' : outlineBorder,
            backgroundColor: outlineBg,
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            minHeight: sizeStyles.minHeight,
          },
          disabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={outlineTextColor} />
        ) : (
          <View style={styles.contentRow}>
            {icon && iconPosition === 'left' && (
              <View style={styles.iconLeft}>{icon}</View>
            )}
            <Text
              numberOfLines={1}
              style={[
                styles.outlineText,
                { color: outlineTextColor, fontSize: sizeStyles.fontSize },
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <View style={styles.iconRight}>{icon}</View>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  outlineBase: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  goldText: {
    color: '#050505',
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  blueText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  outlineText: {
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
