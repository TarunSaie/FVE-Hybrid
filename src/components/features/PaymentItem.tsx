import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { ChevronRight, MoreVertical } from 'lucide-react-native';
import { Payment } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface PaymentItemProps {
  payment: Payment;
  onPress: () => void;
  onMenuPress?: (payment: Payment) => void;
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
  onMenuPress,
  onAvatarPress,
}: PaymentItemProps) {
  const { colors, isDark } = useTheme();
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

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <View
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
          {/* Avatar on left - Independent Touchable */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                if (onAvatarPress) {
                  haptics.light();
                  onAvatarPress(payment);
                }
              }}
              disabled={!onAvatarPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`View profile photo of ${memberName}`}
            >
              <MemberAvatar name={memberName} avatarUrl={avatarUrl} />
            </TouchableOpacity>
          </View>

          {/* Info Block - Middle Pressable for Navigation */}
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{ color: colors.goldMuted, borderless: false }}
            style={styles.infoPressable}
            accessibilityRole="button"
            accessibilityLabel={`View receipt #${payment.receipt_number || 'N/A'} for ${memberName}`}
          >
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
          </Pressable>

          {/* Right Action Container - Sibling Touchable OUTSIDE Pressable */}
          <View style={styles.actionsContainer}>
            {onMenuPress ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  onMenuPress(payment);
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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
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
    marginRight: 10,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  infoPressable: {
    flex: 1,
    marginRight: 8,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  memberName: {
    fontSize: 14,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
    marginRight: 6,
  },
  amount: {
    fontSize: 15,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  receiptNo: {
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  metaDot: {
    marginHorizontal: 4,
    fontSize: 10,
  },
  dateText: {
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  planBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: 160,
  },
  planText: {
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  methodBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  methodText: {
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
  },
  actionsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnMenu: {
    width: 34,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: 2,
  },
});
