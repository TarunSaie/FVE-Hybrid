import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ChevronRight, Phone, Calendar, MessageCircle, Share2 } from 'lucide-react-native';
import { MemberWithMembership } from '@/types';
import { FVEBadge } from '@/components/common/FVEBadge';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDate, getLocalDateStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface MemberCardProps {
  member: MemberWithMembership;
  onPress: () => void;
  onShare?: (member: MemberWithMembership) => void;
  isSharing?: boolean;
  onWhatsAppAlert?: (member: MemberWithMembership) => void;
}

export function MemberCard({ member, onPress, onShare, isSharing, onWhatsAppAlert }: MemberCardProps) {
  const initial = member.full_name?.charAt(0)?.toUpperCase() || '?';
  const scale = useRef(new Animated.Value(1)).current;

  const todayStr = getLocalDateStr();
  const isExpired =
    member.membership_status === 'EXPIRED' ||
    (!!member.membership_expiry_date && member.membership_expiry_date < todayStr);

  const displayStatus = isExpired ? 'EXPIRED' : (member.membership_status || 'NONE');

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
        style={[styles.card, isExpired && styles.expiredCard]}
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
              <FVEBadge status={displayStatus} size="sm" />
              {member.plan_name ? (
                <Text numberOfLines={1} style={styles.planName}>
                  {member.plan_name}
                </Text>
              ) : null}
              {member.membership_expiry_date ? (
                <View style={styles.expiryContainer}>
                  <Calendar size={11} color={colors.textMuted} />
                  <Text style={[styles.expiryText, isExpired && styles.expiredDateText]}>
                    {formatDate(member.membership_expiry_date)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Actions & Chevron */}
          <View style={styles.rightActions}>
            {onShare ? (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  haptics.light();
                  onShare(member);
                }}
                disabled={isSharing}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={styles.shareCardBtn}
              >
                {isSharing ? (
                  <ActivityIndicator size={12} color={colors.gold} />
                ) : (
                  <Share2 size={15} color={colors.gold} />
                )}
              </TouchableOpacity>
            ) : null}

            {isExpired && onWhatsAppAlert ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.medium();
                  onWhatsAppAlert(member);
                }}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.whatsappAlertBtn}
              >
                <MessageCircle size={13} color="#25D366" />
                <Text style={styles.whatsappAlertText}>Alert</Text>
              </TouchableOpacity>
            ) : null}
            <ChevronRight size={18} color={isExpired ? '#F87171' : colors.gold} style={styles.chevron} />
          </View>
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
    marginLeft: 2,
    opacity: 0.6,
  },
  expiredCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#140D0E',
  },
  expiredDateText: {
    color: '#F87171',
    fontFamily: typography.fonts.interSemiBold,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  shareCardBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 161, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 211, 102, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  whatsappAlertText: {
    color: '#25D366',
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
