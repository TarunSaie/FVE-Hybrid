import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

export interface FVEAvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
  badge?: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function FVEAvatar({
  url,
  name,
  size = 36,
  onPress,
  style,
  imageStyle,
  textStyle,
  badge,
  accessibilityLabel,
  disabled = false,
}: FVEAvatarProps) {
  const { colors, isDark } = useTheme();
  const [imageError, setImageError] = useState(false);

  const cleanUrl = url && typeof url === 'string' ? url.trim() : null;

  // Reset error when URL changes
  useEffect(() => {
    setImageError(false);
  }, [cleanUrl]);

  const initial = (name?.trim()?.charAt(0) || 'M').toUpperCase();
  const radius = Math.round(size / 2);
  const fontSize = Math.max(11, Math.round(size * 0.42));

  const content = (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : colors.goldMuted,
          borderColor: colors.goldBorder,
        },
        style,
      ]}
    >
      {cleanUrl && !imageError ? (
        <Image
          source={{ uri: cleanUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
            imageStyle,
          ]}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            {
              fontSize,
              color: colors.gold,
            },
            textStyle,
          ]}
        >
          {initial}
        </Text>
      )}
      {badge && <View style={styles.badgeWrap}>{badge}</View>}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          haptics.light();
          onPress();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || `View profile photo of ${name || 'Member'}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  initial: {
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  badgeWrap: {
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
});
