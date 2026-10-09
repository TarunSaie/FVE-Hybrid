import React, { useRef, useState } from 'react';
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
import { ChevronRight, Phone, Calendar, MessageCircle, FileText, MoreVertical } from 'lucide-react-native';
import { MemberWithMembership } from '@/types';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEModal } from '@/components/common/FVEModal';
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
}

export function MemberCard({
  member,
  onPress,
  onChat,
  onShare,
  isSharing,
  onWhatsAppAlert,
  onAvatarPress,
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

  const [showMenu, setShowMenu] = useState(false);

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
    <>
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
          {/* Tier 1: Avatar, Full Name & Meta Info, and Chevron Indicator */}
          <View style={styles.cardHeader}>
            {/* Avatar with independent full-size photo preview */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                e?.stopPropagation?.();
                if (onAvatarPress) {
                  haptics.light();
                  onAvatarPress(member);
                }
              }}
              disabled={!onAvatarPress}
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

            {/* Info Block with Full Room for Full Name */}
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

              {/* Mobile Contact */}
              {member.mobile ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation?.();
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
          </View>

          {/* Tier 2: Bottom Action Row - Chat, Renewal Remind (if expiring), and More Menu */}
          {(onChat || (isExpiringSoon && onWhatsAppAlert) || onShare) && (
            <View style={[styles.actionsRow, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark }]}>
              {/* Direct WhatsApp Chat */}
              {onChat ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation?.();
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
                  onPress={(e) => {
                    e?.stopPropagation?.();
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
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  haptics.selection();
                  setShowMenu(true);
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
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Card Action Menu Modal */}
      <FVEModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={memberName}
        subtitle={member.member_id ? `Athlete ID: ${member.member_id}` : 'Athlete Options'}
      >
        <View style={styles.menuModalContent}>
          {onShare && (
            <TouchableOpacity
              onPress={() => {
                setShowMenu(false);
                haptics.light();
                onShare(member);
              }}
              disabled={isSharing}
              style={[styles.menuModalItem, { borderColor: colors.borderDark }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Generate athlete pass PDF"
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: colors.goldMuted, minWidth: 40 }]}>
                {isSharing ? (
                  <ActivityIndicator size={16} color={colors.gold} />
                ) : (
                  <FileText size={18} color={colors.gold} />
                )}
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                  Athlete Pass PDF
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  Generate official gym ID pass & share to WhatsApp
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {member.mobile ? (
            <TouchableOpacity
              onPress={() => {
                setShowMenu(false);
                haptics.selection();
                const cleanPhone = member.mobile?.replace(/\D/g, '');
                if (cleanPhone) Linking.openURL(`tel:${cleanPhone}`);
              }}
              style={[styles.menuModalItem, { borderColor: colors.borderDark }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Call ${memberName}`}
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7' }]}>
                <Phone size={18} color="#22C55E" />
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                  Call Athlete
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  {member.mobile}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              setShowMenu(false);
              haptics.light();
              onPress();
            }}
            style={[styles.menuModalItem, { borderColor: colors.borderDark, borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View athlete full profile"
          >
            <View style={[styles.menuModalIconWrap, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE' }]}>
              <ChevronRight size={18} color="#3B82F6" />
            </View>
            <View style={styles.menuModalTextWrap}>
              <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                View Full Profile
              </Text>
              <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                Membership status, payment receipts & attendance history
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </FVEModal>
    </>
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
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  idBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignSelf: 'center',
  },
  idText: {
    fontSize: 10,
    fontFamily: typography.fonts.orbitron,
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
    maxWidth: 130,
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
    marginLeft: 4,
    opacity: 0.8,
  },
  upcomingQueueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  upcomingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#A855F7',
  },
  upcomingQueueText: {
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  actionBtnAlertExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  actionBtnAlertTextExpired: {
    color: '#EF4444',
  },
  actionBtnShare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBtnShareText: {
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
  menuModalContent: {
    paddingVertical: 4,
  },
  menuModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    minHeight: 52,
  },
  menuModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuModalTextWrap: {
    flex: 1,
  },
  menuModalTitle: {
    fontSize: 14,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  menuModalDesc: {
    fontSize: 12,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
});
