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
import { ChevronRight, Share2 } from 'lucide-react-native';
import { Payment } from '@/types';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface PaymentItemProps {
  payment: Payment;
  onPress: () => void;
  onShareWhatsApp?: () => void;
}

function MemberAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={styles.avatarImage}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

export function PaymentItem({
  payment,
  onPress,
  onShareWhatsApp,
}: PaymentItemProps) {
  const memberName = payment.members?.full_name || 'Member';
  const avatarUrl = payment.members?.profile_photo;
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
          <View style={styles.avatarContainer}>
            <MemberAvatar name={memberName} avatarUrl={avatarUrl} />
          </View>

          <View style={styles.info}>
            <View style={styles.topLine}>
              <Text numberOfLines={1} style={styles.memberName}>
                {memberName}
              </Text>
              <Text style={styles.amount}>
                {formatCurrency(payment.amount)}
              </Text>
            </View>

            <View style={styles.bottomLine}>
              <View style={styles.receiptContainer}>
                <Text style={styles.receiptNo}>
                  #{payment.receipt_number || 'N/A'}
                </Text>
                <View style={styles.methodBadge}>
                  <Text style={styles.methodText}>
                    {payment.payment_method || 'CASH'}
                  </Text>
                </View>
              </View>

              <Text style={styles.dateText}>
                {formatDate(payment.payment_date || payment.created_at)}
              </Text>
            </View>
          </View>

          {onShareWhatsApp ? (
            <TouchableOpacity
              onPress={() => {
                haptics.medium();
                onShareWhatsApp();
              }}
              style={styles.shareBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Share2 size={16} color={colors.gold} />
            </TouchableOpacity>
          ) : (
            <ChevronRight size={18} color={colors.textMuted} style={styles.chevron} />
          )}
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
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 161, 0, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 161, 0, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 18,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    lineHeight: 22,
  },
  info: {
    flex: 1,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  amount: {
    color: colors.gold,
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptNo: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  methodBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  methodText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chevron: {
    marginLeft: 6,
    opacity: 0.6,
  },
});

