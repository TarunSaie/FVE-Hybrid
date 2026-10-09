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
import { ChevronRight, Phone, Calendar, MessageCircle, MoreVertical } from 'lucide-react-native';
import { MemberWithMembership } from '@/types';
import { FVEBadge } from '@/components/common/FVEBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { formatDate, getLocalDateStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface MemberCardProps {
  member: MemberWithMembership;
  onPress: () => void;
  onChat?: (member: MemberWithMembership) => void;
  onShare?: (member: MemberWithMembership) => void;
  isSharing?: boolean;
  onWhatsAppAlert?: (member: MemberWithMembership) => void;
  onAvatarPress?: (member: MemberWithMembership) => void;
  onMenuPress?: (member: MemberWithMembership) => void;
}

export function MemberCard({
  member,
  onPress,
  onChat,
  onShare,
  isSharing,
  onWhatsAppAlert,
  onAvatarPress,
  onMenuPress,
}: MemberCardProps) {
  const { colors, isDark } = useTheme();
  const memberName = (member.full_name || (member as any).name || '').trim() || 'Member';
  const initial = memberName.charAt(0).toUpperCase();
  const scale = useRef(new Animated.Value(1)).current;

  const todayStr = getLocalDateStr();
  const isExpired =
    member.membership_status === 'EXPIRED' ||
    (!!member.membership_expiry_date && member.membership_expiry_date < todayStr);
  const isExpiringSoon = !isExpired && member.membership_status === 'EXPIRING_SOON';

  const displayStatus = isExpired ? 'EXPIRED' : (member.membership_status || 'NONE');

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
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
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {/* Tier 1: Avatar (standalone touchable) + Pressable Body (details & chevron) */}
        <View style={styles.cardHeader}>
          {/* Avatar on left - Independent Touchable */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onAvatarPress && onAvatarPress(member)}
            disabled={!onAvatarPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`View full profile photo of ${memberName}`}
            style={styles.avatarContainer}
          >
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
          </TouchableOpacity>

          {/* Info Block & Chevron - Sibling Pressable for Card Navigation */}
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{ color: colors.goldMuted, borderless: false }}
            style={styles.cardBodyPressable}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${memberName}`}
          >
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.name, { color: colors.textPrimary }]}>
                  {memberName}
                </Text>
                {member.member_id && (
                  <View style={[styles.idBadge, { backgroundColor: colors.goldMuted, borderColor: colors.goldBorder }]}>
                    <Text style={[styles.idText, { color: colors.gold }]}>{member.member_id}</Text>
                  </View>
                )}
              </View>

              {/* Mobile Contact Display */}
              {member.mobile ? (
                <View style={styles.detailRow}>
                  <Phone size={12} color={colors.gold} />
                  <Text numberOfLines={1} style={[styles.detailText, { color: colors.gold }]}>{member.mobile}</Text>
                </View>
              ) : null}

              {/* Plan and Expiry Meta Row */}
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

              {/* Upcoming Queued Membership if exists */}
              {member.has_upcoming_membership && member.upcoming_plan_name ? (
                <View
                  style={[
                    styles.upcomingQueueBadge,
                    {
                      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.08)',
                      borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.25)',
                    },
                  ]}
                >
                  <View style={styles.upcomingDot} />
                  <Text
                    numberOfLines={1}
                    style={[styles.upcomingQueueText, { color: isDark ? '#C084FC' : '#9333EA' }]}
                  >
                    Queued: {member.upcoming_plan_name} ({formatDate(member.upcoming_start_date)})
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Chevron Navigation Indicator */}
            <ChevronRight size={18} color={isExpired ? colors.error : colors.gold} style={styles.chevron} />
          </Pressable>
        </View>

        {/* Tier 2: Sibling Action Buttons Row - Standalone Touchables OUTSIDE Pressable */}
        {(onChat || (isExpiringSoon && onWhatsAppAlert) || onMenuPress || onShare) && (
          <View style={[styles.actionsRow, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark }]}>
            {/* Direct WhatsApp Chat */}
            {onChat ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.medium();
                  onChat(member);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${memberName} on WhatsApp`}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={styles.actionBtnWhatsApp}
              >
                <MessageCircle size={14} color="#25D366" />
                <Text style={styles.actionBtnWhatsAppText}>Chat</Text>
              </TouchableOpacity>
            ) : null}

            {/* Proactive Renewal Reminder: ONLY for expiring members */}
            {isExpiringSoon && onWhatsAppAlert ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.medium();
                  onWhatsAppAlert(member);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Send renewal reminder to ${memberName}`}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                style={[styles.actionBtnAlert, { flex: 1.2 }]}
              >
                <MessageCircle size={13} color="#F59E0B" />
                <Text style={styles.actionBtnAlertText}>Renewal Remind</Text>
              </TouchableOpacity>
            ) : null}

            {/* Card Action Menu Button (Overflow) */}
            {(onMenuPress || onShare) && (
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  if (onMenuPress) {
                    onMenuPress(member);
                  } else if (onShare) {
                    onShare(member);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${memberName}`}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.actionBtnMenu,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: colors.borderDark,
                  },
                ]}
              >
                {isSharing ? (
                  <ActivityIndicator size={13} color={colors.gold} />
                ) : (
                  <MoreVertical size={16} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBodyPressable: {
    flex: 1,
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
    borderWidth: 1.5,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 20,
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
  },
  name: {
    fontSize: 15,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  idBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  idText: {
    fontSize: 10,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryText: {
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  upcomingQueueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  upcomingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C084FC',
    marginRight: 5,
  },
  upcomingQueueText: {
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    borderRadius: 9,
    paddingVertical: 7,
  },
  actionBtnWhatsAppText: {
    color: '#25D366',
    fontSize: 12,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  actionBtnAlert: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 9,
    paddingVertical: 7,
  },
  actionBtnAlertText: {
    color: '#F59E0B',
    fontSize: 12,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  actionBtnMenu: {
    width: 36,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
