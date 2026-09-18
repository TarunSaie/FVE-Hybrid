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
  Linking,
} from 'react-native';
import { ChevronRight, Phone, Calendar, MessageCircle } from 'lucide-react-native';
import { MemberWithMembership } from '@/types';
import { FVEBadge } from '@/components/common/FVEBadge';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { colors, isDark } = useTheme();
  const initial = member.full_name?.charAt(0)?.toUpperCase() || '?';
  const scale = useRef(new Animated.Value(1)).current;

  const todayStr = getLocalDateStr();
  const isExpired =
    member.membership_status === 'EXPIRED' ||
    (!!member.membership_expiry_date && member.membership_expiry_date < todayStr);
  const isExpiringSoon = !isExpired && member.membership_status === 'EXPIRING_SOON';

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

  const cardBg = isExpired
    ? isDark ? '#140D0E' : '#FEF2F2'
    : isExpiringSoon
    ? isDark ? '#12100A' : '#FFFBEB'
    : colors.cardBackground;

  const cardBorder = isExpired
    ? isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.25)'
    : isExpiringSoon
    ? isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.25)'
    : colors.borderDark;

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: colors.goldMuted, borderless: false }}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        <View style={styles.contentRow}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {member.profile_photo ? (
              <Image source={{ uri: member.profile_photo }} style={[styles.avatar, { borderColor: colors.goldBorder }]} />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {
                    backgroundColor: isDark ? '#181C24' : '#EDF2F7',
                    borderColor: colors.goldBorder,
                  },
                ]}
              >
                <Text style={[styles.fallbackText, { color: colors.gold }]}>{initial}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>
                {member.full_name}
              </Text>
              {member.member_id && (
                <View style={[styles.idBadge, { backgroundColor: colors.goldMuted, borderColor: colors.goldBorder }]}>
                  <Text style={[styles.idText, { color: colors.gold }]}>{member.member_id}</Text>
                </View>
              )}
            </View>

            {member.mobile ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  const cleanPhone = member.mobile?.replace(/\D/g, '');
                  if (cleanPhone) Linking.openURL(`tel:${cleanPhone}`);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                style={styles.detailRow}
              >
                <Phone size={12} color={colors.gold} />
                <Text numberOfLines={1} style={[styles.detailText, { color: colors.gold }]}>{member.mobile}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.statusRow}>
              <FVEBadge status={displayStatus} size="sm" />
              {member.plan_name ? (
                <Text numberOfLines={1} style={[styles.planName, { color: colors.textSecondary }]}>
                  {member.plan_name}
                </Text>
              ) : null}
              {member.membership_expiry_date ? (
                <View style={styles.expiryContainer}>
                  <Calendar size={11} color={colors.textMuted} />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.expiryText,
                      { color: colors.textMuted },
                      isExpired && { color: colors.error, fontWeight: '700' },
                    ]}
                  >
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
                accessibilityLabel={`Share ${member.full_name}'s member pass on WhatsApp`}
                accessibilityHint="Opens the registered member's WhatsApp chat with their PDF pass attached"
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={[styles.shareCardBtn, { backgroundColor: colors.goldMuted, borderColor: colors.goldBorder }]}
              >
                {isSharing ? (
                  <ActivityIndicator size={12} color={colors.gold} />
                ) : (
                  <MessageCircle size={15} color="#25D366" />
                )}
              </TouchableOpacity>
            ) : null}

            {(isExpired || isExpiringSoon) && onWhatsAppAlert ? (
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
                <Text style={styles.whatsappAlertText}>
                  {isExpiringSoon ? 'Remind' : 'Alert'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <ChevronRight size={18} color={isExpired ? colors.error : colors.gold} style={styles.chevron} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
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
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginRight: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    flexWrap: 'nowrap',
  },
  name: {
    flexShrink: 1,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  idBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  idText: {
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
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  planName: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    maxWidth: 110,
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expiryText: {
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  chevron: {
    marginLeft: 2,
    opacity: 0.7,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  shareCardBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
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
