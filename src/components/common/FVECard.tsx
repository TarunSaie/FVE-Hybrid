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
import { colors } from '@/constants/colors';
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

  const borderColor =
    variant === 'blue'
      ? 'rgba(56, 189, 248, 0.22)'
      : variant === 'gold'
      ? 'rgba(239, 161, 0, 0.2)'
      : 'rgba(255, 255, 255, 0.08)';

  const gradientColors =
    variant === 'blue'
      ? (['#0E1624', '#0A0E17'] as const)
      : variant === 'plain'
      ? (['#14171C', '#0E1013'] as const)
      : (['#161920', '#101217'] as const);

  const cardContent = (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, { borderColor }, contentStyle]}
    >
      {children}
    </LinearGradient>
  );

  if (isPressable) {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, styles.container, style]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {cardContent}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={[styles.container, style]}>{cardContent}</View>;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  gradient: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
});
