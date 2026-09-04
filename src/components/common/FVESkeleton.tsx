import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

// Shared animated value at module level so all skeletons pulse in sync
const pulseAnim = new Animated.Value(0);
let animationStarted = false;

function startPulse() {
  if (animationStarted) return;
  animationStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])
  ).start();
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  useEffect(() => { startPulse(); }, []);

  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  return (
    <Animated.View
      style={[
        styles.box,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

// ── Pre-built skeleton layouts ─────────────────────────────────────────────

export function SkeletonMemberCard() {
  return (
    <View style={styles.memberCard}>
      <SkeletonBox width={48} height={48} borderRadius={24} />
      <View style={styles.memberCardRight}>
        <SkeletonBox width="60%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonBox width="40%" height={11} borderRadius={5} style={{ marginBottom: 6 }} />
        <SkeletonBox width="50%" height={11} borderRadius={5} />
      </View>
    </View>
  );
}

export function SkeletonStatCard() {
  return (
    <View style={styles.statCard}>
      <SkeletonBox width="100%" height={100} borderRadius={16} />
    </View>
  );
}

export function SkeletonPaymentRow() {
  return (
    <View style={styles.payRow}>
      <SkeletonBox width={44} height={44} borderRadius={14} />
      <View style={styles.payRowRight}>
        <SkeletonBox width="55%" height={13} borderRadius={5} style={{ marginBottom: 8 }} />
        <SkeletonBox width="35%" height={10} borderRadius={4} />
      </View>
      <SkeletonBox width={60} height={13} borderRadius={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFFFFF',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  memberCardRight: {
    flex: 1,
    marginLeft: 12,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  payRowRight: {
    flex: 1,
  },
});
