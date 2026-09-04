import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Animated,
} from 'react-native';
import { ChevronRight, Phone, Calendar } from 'lucide-react-native';
import { MemberWithMembership } from '@/types';
import { FVEBadge } from '@/components/common/FVEBadge';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDate } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface MemberCardProps {
  member: MemberWithMembership;
  onPress: () => void;
}

export function MemberCard({ member, onPress }: MemberCardProps) {
  const initial = member.full_name?.charAt(0)?.toUpperCase() || '?';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.975,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: 'rgba(239, 161, 0, 0.12)', borderless: false }}
        style={styles.card}
      >
        <View style={styles.contentRow}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {member.profile_photo ? (
              <Image source={{ uri: member.profile_photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.fallbackText}>{initial}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>
                {member.full_name}
              </Text>
              {member.member_id && (
                <View style={styles.idBadge}>
                  <Text style={styles.idText}>{member.member_id}</Text>
                </View>
              )}
            </View>

            {member.mobile ? (
              <View style={styles.detailRow}>
                <Phone size={12} color={colors.textMuted} />
                <Text style={styles.detailText}>{member.mobile}</Text>
              </View>
            ) : null}

            <View style={styles.statusRow}>
              <FVEBadge status={member.membership_status || 'NONE'} size="sm" />
              {member.plan_name ? (
                <Text numberOfLines={1} style={styles.planName}>
                  {member.plan_name}
                </Text>
              ) : null}
              {member.membership_expiry_date ? (
                <View style={styles.expiryContainer}>
                  <Calendar size={11} color={colors.textMuted} />
                  <Text style={styles.expiryText}>
                    {formatDate(member.membership_expiry_date)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Chevron */}
          <ChevronRight size={18} color={colors.gold} style={styles.chevron} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#181C24',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.gold,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  idBadge: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  idText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planName: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    maxWidth: 120,
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expiryText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  chevron: {
    marginLeft: 6,
    opacity: 0.6,
  },
});
