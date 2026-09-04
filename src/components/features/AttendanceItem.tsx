import React, { useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Animated } from 'react-native';
import { Clock, QrCode, UserCheck } from 'lucide-react-native';
import { Attendance } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface AttendanceItemProps {
  item: Attendance & { members?: { full_name?: string; profile_photo?: string | null; member_id?: string | null } };
  onPress?: () => void;
}

export function AttendanceItem({ item, onPress }: AttendanceItemProps) {
  const memberName = item.members?.full_name || 'Member';
  const memberId = item.members?.member_id;
  const photo = item.members?.profile_photo;
  const initial = memberName.charAt(0).toUpperCase();

  const isQR = item.check_in_method === 'QR';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 35, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 4 }).start();

  // Format check_in_time
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
        style={styles.container}
        android_ripple={{ color: 'rgba(239,161,0,0.08)', borderless: false }}
      >
      <View style={styles.leftRow}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={styles.fallbackAvatar}>
            <Text style={styles.fallbackText}>{initial}</Text>
          </View>
        )}

        <View style={styles.details}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {memberName}
            </Text>
            {memberId && (
              <View style={styles.idBadge}>
                <Text style={styles.idText}>{memberId}</Text>
              </View>
            )}
          </View>

          <View style={styles.timeRow}>
            <Clock size={12} color={colors.textMuted} />
            <Text style={styles.timeText}>{formatTime(item.check_in_time)}</Text>
            {item.date ? (
              <Text style={styles.dateText}>· {item.date}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Check-in Method Badge */}
      <View
        style={[
          styles.methodBadge,
          {
            backgroundColor: isQR ? colors.goldMuted : 'rgba(59, 130, 246, 0.12)',
            borderColor: isQR ? colors.goldBorder : colors.blueBorder,
          },
        ]}
      >
        {isQR ? (
          <QrCode size={12} color={colors.gold} style={styles.methodIcon} />
        ) : (
          <UserCheck size={12} color={colors.blueLight} style={styles.methodIcon} />
        )}
        <Text
          style={[
            styles.methodText,
            { color: isQR ? colors.gold : colors.blueLight },
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
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    marginRight: 12,
  },
  fallbackAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#181C24',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fallbackText: {
    color: colors.gold,
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
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  idBadge: {
    backgroundColor: colors.goldMuted,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  idText: {
    color: colors.gold,
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
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
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
