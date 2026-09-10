import React, { useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { haptics } from '@/utils/haptics';

interface FVECardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'gold' | 'blue' | 'plain';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function FVECard({
  children,
  onPress,
  variant = 'gold',
  style,
  contentStyle,
}: FVECardProps) {
  const { colors, isDark } = useTheme();
  const isPressable = typeof onPress === 'function';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!isPressable) return;
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (!isPressable) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (!isPressable || !onPress) return;
    haptics.light();
    onPress();
  };

  const borderColor = isDark
    ? variant === 'blue'
      ? 'rgba(56, 189, 248, 0.22)'
      : variant === 'gold'
      ? colors.border
      : colors.borderLight
    : variant === 'blue'
    ? 'rgba(0, 92, 230, 0.25)'
    : variant === 'gold'
    ? 'rgba(217, 130, 0, 0.25)'
    : colors.borderDark;

  const gradientColors = isDark
    ? variant === 'blue'
      ? (['#0E1624', '#0A0E17'] as const)
      : variant === 'plain'
      ? (['#14171C', '#0E1013'] as const)
      : (['#161920', '#101217'] as const)
    : variant === 'blue'
    ? (['#FFFFFF', '#F0F5FF'] as const)
    : variant === 'plain'
    ? (['#FFFFFF', '#F8FAFC'] as const)
    : (['#FFFFFF', '#FCFBF8'] as const);

  const shadowStyles = isDark
    ? {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
      }
    : {
        shadowColor: 'rgba(15, 23, 42, 0.08)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 2,
      };

  const cardContent = (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradient,
        {
          borderColor,
          backgroundColor: colors.cardBackground,
        },
        contentStyle,
      ]}
    >
      {children}
    </LinearGradient>
  );

  if (isPressable) {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, styles.container, shadowStyles, style]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={{
            color: variant === 'blue' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 161, 0, 0.12)',
            borderless: false,
          }}
          style={{ borderRadius: 18, overflow: 'hidden' }}
        >
          {cardContent}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={[styles.container, shadowStyles, style]}>{cardContent}</View>;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
  },
  gradient: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
});
