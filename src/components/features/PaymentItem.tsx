import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Animated,
  Image,
  Alert,
} from 'react-native';
import { ChevronRight, Share2, Trash2, MoreVertical, FileText } from 'lucide-react-native';
import { Payment } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { FVEModal } from '@/components/common/FVEModal';

interface PaymentItemProps {
  payment: Payment;
  onPress: () => void;
  onShareWhatsApp?: () => void;
  onDelete?: () => void;
  onAvatarPress?: (payment: Payment) => void;
}

function MemberAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const { colors, isDark } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.avatarImage, { borderColor: colors.goldBorder }]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          backgroundColor: isDark ? 'rgba(239, 161, 0, 0.14)' : colors.goldMuted,
          borderColor: colors.goldBorder,
        },
      ]}
    >
      <Text style={[styles.avatarInitial, { color: colors.gold }]}>{initial}</Text>
    </View>
  );
}

export function PaymentItem({
  payment,
  onPress,
  onShareWhatsApp,
  onDelete,
  onAvatarPress,
}: PaymentItemProps) {
  const { colors, isDark } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const memberName = payment.members?.full_name || 'Member';
  const avatarUrl = payment.members?.profile_photo;
  const scale = useRef(new Animated.Value(1)).current;

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

  const handleDeleteWithConfirmation = () => {
    haptics.warning();
    Alert.alert(
      'Delete Payment Record',
      `Are you sure you want to revert or delete payment receipt #${payment.receipt_number || 'N/A'} of ${formatCurrency(payment.amount)} for ${memberName}?\n\nThis transaction will be removed from financial records and member logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Payment',
          style: 'destructive',
          onPress: () => {
            onDelete?.();
          },
        },
      ]
    );
  };

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
              backgroundColor: colors.cardBackground,
              borderColor: colors.borderDark,
              shadowColor: colors.shadowColor,
            },
          ]}
        >
          <View style={styles.contentRow}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={(e) => {
                  if (onAvatarPress) {
                    haptics.light();
                    onAvatarPress(payment);
                  }
                }}
                disabled={!onAvatarPress}
                accessibilityRole="button"
                accessibilityLabel={`View profile photo of ${memberName}`}
              >
                <MemberAvatar name={memberName} avatarUrl={avatarUrl} />
              </TouchableOpacity>
            </View>

            <View style={styles.info}>
              <View style={styles.topLine}>
                <Text numberOfLines={1} style={[styles.memberName, { color: colors.textPrimary }]}>
                  {memberName}
                </Text>
                <Text style={[styles.amount, { color: colors.gold }]}>
                  {formatCurrency(payment.amount)}
                </Text>
              </View>

              <View style={styles.metaLine}>
                <Text style={[styles.receiptNo, { color: colors.textSecondary }]}>
                  #{payment.receipt_number || 'N/A'}
                </Text>
                <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
                <Text style={[styles.dateText, { color: colors.textMuted }]}>
                  {formatDate(payment.payment_date || payment.created_at)}
                </Text>
              </View>

              <View style={styles.badgesRow}>
                {payment.memberships?.membership_plans?.name ? (
                  <View
                    style={[
                      styles.planBadge,
                      {
                        backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : colors.goldMuted,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                  >
                    <Text numberOfLines={1} style={[styles.planText, { color: colors.gold }]}>
                      {payment.memberships.membership_plans.name}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.methodBadge,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.chipBackground,
                    },
                  ]}
                >
                  <Text style={[styles.methodText, { color: colors.textMuted }]}>
                    {payment.payment_method || 'CASH'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              {onShareWhatsApp || onDelete ? (
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setShowMenu(true);
                  }}
                  style={[
                    styles.actionBtnMenu,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: colors.borderDark,
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Options for receipt #${payment.receipt_number || 'N/A'}`}
                >
                  <MoreVertical size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <ChevronRight size={18} color={colors.textMuted} style={styles.chevron} />
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Payment Action Menu Modal */}
      <FVEModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={`Receipt #${payment.receipt_number || 'N/A'}`}
        subtitle={`${memberName} · ${formatCurrency(payment.amount)}`}
      >
        <View style={styles.menuModalContent}>
          {onShareWhatsApp && (
            <TouchableOpacity
              onPress={() => {
                setShowMenu(false);
                haptics.medium();
                onShareWhatsApp();
              }}
              style={[styles.menuModalItem, { borderColor: colors.borderDark }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share receipt on WhatsApp"
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: isDark ? 'rgba(37, 211, 102, 0.15)' : '#DCFCE7' }]}>
                <Share2 size={18} color="#25D366" />
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                  Share Receipt on WhatsApp
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  Send official receipt confirmation to member phone
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setShowMenu(false);
              haptics.light();
              onPress();
            }}
            style={[styles.menuModalItem, { borderColor: colors.borderDark }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View receipt details"
          >
            <View style={[styles.menuModalIconWrap, { backgroundColor: colors.goldMuted }]}>
              <FileText size={18} color={colors.gold} />
            </View>
            <View style={styles.menuModalTextWrap}>
              <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                View Receipt Details
              </Text>
              <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                Full payment breakdown, method and plan validity
              </Text>
            </View>
          </TouchableOpacity>

          {onDelete && (
            <TouchableOpacity
              onPress={() => {
                setShowMenu(false);
                handleDeleteWithConfirmation();
              }}
              style={[styles.menuModalItem, { borderColor: colors.borderDark, borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete payment"
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                <Trash2 size={18} color="#EF4444" />
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: '#EF4444' }]}>
                  Delete / Revert Payment
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  Requires confirmation · Reverts plan & records
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </FVEModal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    lineHeight: 20,
  },
  info: {
    flex: 1,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  memberName: {
    fontSize: 14.5,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 15,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  metaDot: {
    fontSize: 11,
    fontWeight: '700',
  },
  receiptNo: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    maxWidth: 150,
  },
  planText: {
    fontSize: 9.5,
    fontFamily: typography.fonts.inter,
    fontWeight: '700',
  },
  methodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  methodText: {
    fontSize: 9.5,
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 10.5,
    fontFamily: typography.fonts.inter,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  actionBtnMenu: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: 2,
    opacity: 0.6,
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
