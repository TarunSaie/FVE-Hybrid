import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface FVELoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function FVELoading({
  message = 'INITIALIZING FITVERSE ELITE',
  fullScreen = true,
}: FVELoadingProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.92)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Gentle luxury pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Sleek progress shimmer
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => {
      pulse.stop();
      shimmer.stop();
    };
  }, [fadeAnim, pulseAnim, shimmerAnim]);

  const progressTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60],
  });

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Glowing Halo Around Emblem */}
        <Animated.View
          style={[
            styles.haloContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.glowRing} />
          <Image
            source={require('@/../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Typography */}
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>FITVERSE</Text>
          <Text style={styles.brandSubtitle}>E L I T E</Text>
          <View style={styles.goldDivider} />
          <Text style={styles.tagline}>DISCIPLINE · STRENGTH · TRANSFORMATION</Text>
        </View>

        {/* Sleek Progress Indicator */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressIndicator,
              { transform: [{ translateX: progressTranslate }] },
            ]}
          />
        </View>

        {/* Status Message */}
        <Text numberOfLines={1} style={styles.statusText}>
          {message.toUpperCase()}
        </Text>
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      padding: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    fullScreen: {
      flex: 1,
      minHeight: 400,
    },
    content: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    haloContainer: {
      width: 120,
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      position: 'relative',
    },
    glowRing: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.08)' : 'rgba(217, 130, 0, 0.08)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.35)',
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 18,
      elevation: 8,
    },
    logo: {
      width: 72,
      height: 72,
    },
    brandBlock: {
      alignItems: 'center',
      marginBottom: 32,
    },
    brandTitle: {
      color: colors.gold,
      fontSize: 26,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '800',
      letterSpacing: 4,
      textAlign: 'center',
    },
    brandSubtitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '600',
      letterSpacing: 8,
      marginTop: 2,
      textAlign: 'center',
    },
    goldDivider: {
      width: 48,
      height: 1.5,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.4)' : 'rgba(217, 130, 0, 0.4)',
      marginVertical: 12,
      borderRadius: 1,
    },
    tagline: {
      color: colors.textSecondary,
      fontSize: 9,
      fontFamily: typography.fonts.inter,
      letterSpacing: 2,
      textAlign: 'center',
    },
    progressTrack: {
      width: 140,
      height: 2.5,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressIndicator: {
      width: 60,
      height: '100%',
      backgroundColor: colors.gold,
      borderRadius: 2,
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 6,
      elevation: 4,
    },
    statusText: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1.5,
      textAlign: 'center',
    },
  });

