import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { PersonalTraining, PAYMENT_METHODS, Payment } from '@/types';
import { formatCurrency, generateReceiptNumber } from '@/utils/format';
import { getLocalDateStr, calculateExpiryDate } from '@/utils/date';
import { CreditCard, ShieldCheck } from 'lucide-react-native';
import { RootStackParamList } from '@/navigation/types';

interface PTPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (paymentRecord?: Payment) => void;
  pt: PersonalTraining;
}

export function PTPaymentModal({
  visible,
  onClose,
  onSaved,
  pt,
}: PTPaymentModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getPTPaymentStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [amount, setAmount] = useState<string>(String(pt.price || '6000'));
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setAmount(String(pt.price || '6000'));
      setPaymentMethod('Cash');
      setTransactionRef('');
      setNotes('');
    }
  }, [visible, pt]);

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      haptics.warning();
      Alert.alert('Required', 'Please specify a valid payment amount');
      return;
    }
    if (paymentMethod !== 'Cash' && !transactionRef.trim()) {
      haptics.warning();
      Alert.alert('Required', `Transaction reference ID is required for ${paymentMethod}`);
      return;
    }

    setLoading(true);
    try {
      const today = getLocalDateStr();
      const receiptNo = generateReceiptNumber();
      const expiryStr = calculateExpiryDate(today, 45);

      // 1. Insert separate payment for Personal Training add-on
      const { data: paymentRecord, error: pErr } = await supabase
        .from('payments')
        .insert({
          member_id: pt.member_id,
          membership_id: pt.membership_id || null, // Linked to active membership
          amount: String(numAmount),
          payment_method: paymentMethod,
          transaction_reference: transactionRef.trim(),
          received_by: user?.id || null,
          payment_date: today,
          receipt_number: receiptNo,
          notes: `Personal Training Add-On: ${pt.package_name} (${pt.total_sessions} sessions). ${notes.trim()}`.trim(),
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Activate Personal Training service
      const { error: ptErr } = await supabase
        .from('personal_training')
        .update({
          payment_id: paymentRecord.id,
          status: 'ACTIVE',
          price: String(numAmount),
          start_date: today,
          expiry_date: expiryStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pt.id);

      if (ptErr) throw ptErr;

      // 3. Broadcast notification
      try {
        const targetIds = new Set<string>();
        if (pt.trainer_id) targetIds.add(pt.trainer_id);

        const { data: admins } = await supabase
          .from('user_profiles')
          .select('id')
          .in('role', ['OWNER', 'ADMIN']);

        (admins || []).forEach(a => targetIds.add(a.id));

        const notifs = Array.from(targetIds).map(uid => ({
          user_id: uid,
          title: 'Personal Training Activated',
          message: `${formatCurrency(numAmount)} received for ${pt.members?.full_name || 'Member'}'s ${pt.package_name}. Sessions are ready to schedule!`,
          type: 'SUCCESS',
        }));

        if (notifs.length > 0) {
          await supabase.from('notifications').insert(notifs);
        }
      } catch {
        // Suppress
      }

      haptics.success();
      Alert.alert(
        'Payment Recorded',
        `Personal Training plan activated successfully!\nReceipt: #${receiptNo}`,
        [
          {
            text: 'View Receipt',
            onPress: () => {
              onSaved(paymentRecord as Payment);
              onClose();
              navigation.navigate('PaymentReceipt', { payment: paymentRecord as Payment });
            },
          },
          {
            text: 'Done',
            onPress: () => {
              onSaved(paymentRecord as Payment);
              onClose();
            },
          },
        ]
      );
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to complete PT payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="COLLECT PT PAYMENT"
      subtitle={`Client: ${pt.members?.full_name || 'Member'}`}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Program:</Text>
            <Text style={styles.summaryValGold}>{pt.package_name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Sessions:</Text>
            <Text style={styles.summaryVal}>{pt.total_sessions} Sessions</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Assigned Trainer:</Text>
            <Text style={[styles.summaryVal, { color: '#C084FC' }]}>
              {pt.trainer?.full_name || 'Assigned Staff Trainer'}
            </Text>
          </View>
        </View>

        {/* Protection callout */}
        <View style={styles.protectionBox}>
          <ShieldCheck size={16} color={colors.success} />
          <Text style={styles.protectionText}>
            Base gym subscription remains 100% active and untouched.
          </Text>
        </View>

        {/* Amount */}
        <FVEInput
          label="AMOUNT TO COLLECT (₹) *"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="6000"
        />

        {/* Payment Method */}
        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PAYMENT METHOD</Text>
        <View style={styles.methodGrid}>
          {PAYMENT_METHODS.map(method => (
            <TouchableOpacity
              key={method}
              onPress={() => {
                haptics.selection();
                setPaymentMethod(method);
              }}
              style={[
                styles.methodBtn,
                paymentMethod === method && styles.methodBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                {method}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction reference */}
        {paymentMethod !== 'Cash' && (
          <FVEInput
            label="TRANSACTION / UPI REFERENCE *"
            value={transactionRef}
            onChangeText={setTransactionRef}
            placeholder="e.g. UPI / UTR Reference ID"
            containerStyle={{ marginTop: 12 }}
          />
        )}

        {/* Notes */}
        <FVEInput
          label="RECEIPT NOTES (OPTIONAL)"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Paid via GooglePay"
          containerStyle={{ marginTop: 12 }}
        />

        {/* Submit button */}
        <FVEButton
          title="CONFIRM & ACTIVATE PT"
          onPress={handleSubmit}
          loading={loading}
          variant="gold"
          size="lg"
          style={{ marginTop: 20, marginBottom: 10 }}
        />
      </ScrollView>
    </FVEModal>
  );
}

const getPTPaymentStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    summaryCard: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      marginBottom: 10,
      gap: 6,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: typography.fonts.inter,
    },
    summaryVal: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '600',
      fontFamily: typography.fonts.inter,
    },
    summaryValGold: {
      fontSize: 12,
      color: colors.gold,
      fontWeight: '700',
      fontFamily: typography.fonts.rajdhani,
    },
    protectionBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)',
      borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.35)',
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
    },
    protectionText: {
      flex: 1,
      fontSize: 11,
      color: colors.success,
      fontFamily: typography.fonts.inter,
      fontWeight: '500',
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
      fontFamily: typography.fonts.rajdhani,
    },
    methodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    methodBtn: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      alignItems: 'center',
    },
    methodBtnActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(239, 161, 0, 0.18)',
      borderColor: colors.gold,
    },
    methodText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
      fontFamily: typography.fonts.inter,
    },
    methodTextActive: {
      color: colors.gold,
      fontWeight: '700',
    },
  });
