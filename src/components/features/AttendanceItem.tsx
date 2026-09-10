import React, { useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Animated } from 'react-native';
import { Clock, QrCode, UserCheck } from 'lucide-react-native';
import { Attendance } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';

interface AttendanceItemProps {
  item: Attendance & { members?: { full_name?: string; profile_photo?: string | null; member_id?: string | null } };
  onPress?: () => void;
}

export function AttendanceItem({ item, onPress }: AttendanceItemProps) {
  const { colors, isDark } = useTheme();
  const memberName = item.members?.full_name || 'Member';
  const memberId = item.members?.member_id;
  const photo = item.members?.profile_photo;
  const initial = memberName.charAt(0).toUpperCase();

  const isQR = item.check_in_method === 'QR';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 35, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 4 }).start();

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '';
    try {
      if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${m} ${ampm}`;
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.borderDark,
            shadowColor: colors.shadowColor,
          },
        ]}
        android_ripple={{ color: colors.goldMuted, borderless: false }}
      >
        <View style={styles.leftRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={[styles.avatar, { borderColor: colors.goldBorder }]} />
          ) : (
            <View
              style={[
                styles.fallbackAvatar,
                {
                  backgroundColor: isDark ? '#181C24' : '#EDF2F7',
                  borderColor: colors.goldBorder,
                },
              ]}
            >
              <Text style={[styles.fallbackText, { color: colors.gold }]}>{initial}</Text>
            </View>
          )}

          <View style={styles.details}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>
                {memberName}
              </Text>
              {memberId && (
                <View style={[styles.idBadge, { backgroundColor: colors.goldMuted, borderColor: colors.goldBorder }]}>
                  <Text style={[styles.idText, { color: colors.gold }]}>{memberId}</Text>
                </View>
              )}
            </View>

            <View style={styles.timeRow}>
              <Clock size={12} color={colors.textMuted} />
              <Text numberOfLines={1} style={[styles.timeText, { color: colors.textSecondary }]}>
                {formatTime(item.check_in_time)}
                {item.date ? ` · ${item.date}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Check-in Method Badge */}
        <View
          style={[
            styles.methodBadge,
            {
              backgroundColor: isQR ? colors.goldMuted : colors.blueMuted,
              borderColor: isQR ? colors.goldBorder : colors.blueBorder,
            },
          ]}
        >
          {isQR ? (
            <QrCode size={12} color={colors.gold} style={styles.methodIcon} />
          ) : (
            <UserCheck size={12} color={colors.blue} style={styles.methodIcon} />
          )}
          <Text
            style={[
              styles.methodText,
              { color: isQR ? colors.gold : colors.blue },
            ]}
          >
            {isQR ? 'QR SCAN' : 'MANUAL'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    marginRight: 12,
  },
  fallbackAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fallbackText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  details: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    flexWrap: 'nowrap',
  },
  name: {
    flexShrink: 1,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  idBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  idText: {
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    flexShrink: 1,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  methodIcon: {
    marginRight: 4,
  },
  methodText: {
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
