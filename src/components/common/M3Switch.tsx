import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { haptics } from '@/utils/haptics';

export interface M3SwitchProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  disabled?: boolean;
  activeTrackColor?: string;
  inactiveTrackColor?: string;
  inactiveBorderColor?: string;
  activeThumbColor?: string;
  inactiveThumbColor?: string;
  showIcon?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * Material Design 3 (M3) Specification Switch
 * - Track: 52dp width x 32dp height, fully rounded pill (16dp radius).
 * - Off State: 16dp thumb centered vertically with 2dp track outline.
 * - On State: Thumb expands to 24dp with primary track fill and optional check icon.
 * - Spring-driven smooth 60fps interpolation matching Google Material 3 specs.
 */
export function M3Switch({
  value,
  onValueChange,
  disabled = false,
  activeTrackColor,
  inactiveTrackColor,
  inactiveBorderColor,
  activeThumbColor,
  inactiveThumbColor,
  showIcon = true,
  style,
  testID,
  accessibilityLabel,
}: M3SwitchProps) {
  const { colors, isDark } = useTheme();

  // Resolved Colors based on current theme
  const resolvedActiveTrack = activeTrackColor || colors.gold;
  const resolvedInactiveTrack =
    inactiveTrackColor || (isDark ? '#161922' : '#E2E8F0');
  const resolvedInactiveBorder =
    inactiveBorderColor || (isDark ? '#3D4455' : '#94A3B8');
  const resolvedActiveThumb = activeThumbColor || '#050505';
  const resolvedInactiveThumb =
    inactiveThumbColor || (isDark ? '#8E95A5' : '#64748B');

  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      bounciness: 2,
      speed: 15,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const handlePress = () => {
    if (disabled) return;
    haptics.selection();
    onValueChange(!value);
  };

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [resolvedInactiveTrack, resolvedActiveTrack],
  });

  const trackBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [resolvedInactiveBorder, resolvedActiveTrack],
  });

  const thumbLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 24],
  });

  const thumbTop = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 2],
  });

  const thumbSize = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 24],
  });

  const thumbRadius = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 12],
  });

  const thumbBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [resolvedInactiveThumb, resolvedActiveThumb],
  });

  const iconOpacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.touchTarget, style, disabled && styles.disabled]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: trackBg,
            borderColor: trackBorder,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              left: thumbLeft,
              top: thumbTop,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbRadius,
              backgroundColor: thumbBg,
            },
          ]}
        >
          {showIcon && (
            <Animated.View style={{ opacity: iconOpacity }}>
              <Check size={13} color={resolvedActiveTrack} strokeWidth={3.2} />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: 52,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 3,
  },
  disabled: {
    opacity: 0.4,
  },
});
