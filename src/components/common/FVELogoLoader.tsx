import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface FVELogoLoaderProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function FVELogoLoader({
  message = 'LOADING...',
  size = 100,
  fullScreen = false,
  style,
}: FVELogoLoaderProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={[fullScreen ? styles.fullScreen : styles.inlineContainer, style]}>
      <View style={[styles.loaderBox, { width: size, height: size }]}>
        <Image
          source={require('@/../assets/fitverse_loader.gif')}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
      {message ? (
        <Text style={styles.message}>{message.toUpperCase()}</Text>
      ) : null}
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    fullScreen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      minHeight: 280,
    },
    inlineContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    loaderBox: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      overflow: 'hidden',
    },
    message: {
      marginTop: 14,
      color: colors.gold,
      fontSize: 11,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '700',
      letterSpacing: 1.5,
      textAlign: 'center',
    },
  });
