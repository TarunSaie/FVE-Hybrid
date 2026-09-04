import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { Member, MembershipPlan, PAYMENT_METHODS } from '@/types';
import { supabase } from '@/api/supabase';
import { getLocalDateStr } from '@/utils/date';
import { formatCurrency, generateReceiptNumber } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface PaymentFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  preselectedMemberId?: string | null;
}

export function PaymentFormModal({
  visible,
  onClose,
  onSaved,
  preselectedMemberId,
}: PaymentFormModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(preselectedMemberId || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (visible) {
      // Fetch members and plans
      supabase.from('members').select('id, full_name, mobile, member_id, joining_date').order('full_name').then(({ data }) => {
        setMembers((data || []) as Member[]);
      });

      supabase.from('membership_plans').select('*').eq('active', true).order('price').then(({ data }) => {
        setPlans((data || []) as MembershipPlan[]);
      });

      if (preselectedMemberId) {
        setSelectedMemberId(preselectedMemberId);
      }
    }
  }, [visible, preselectedMemberId]);

  const handlePlanSelect = (plan: MembershipPlan) => {
    setSelectedPlanId(plan.id);
    setAmount(String(plan.price));
  };

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      Alert.alert('Error', 'Please select a member');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    try {
      const today = getLocalDateStr();
      const receiptNumber = generateReceiptNumber();

      let membershipId: string | null = null;

      // If a plan is selected, create a membership
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
        const memberObj = members.find(m => m.id === selectedMemberId);
        let subStartDate = today;

        // If member has no active/expiring memberships, default to joining date
        if (memberObj?.joining_date) {
          const { data: activeMs } = await supabase
            .from('memberships')
            .select('id')
            .eq('member_id', selectedMemberId)
            .in('status', ['ACTIVE', 'EXPIRING_SOON']);
          if (!activeMs || activeMs.length === 0) {
            subStartDate = memberObj.joining_date;
          }
        }

        const [sy, sm, sd] = subStartDate.split('T')[0].split('-').map(Number);
        const sDate = new Date(sy, sm - 1, sd);
        const eDate = new Date(sDate);
        eDate.setDate(sDate.getDate() + selectedPlan.duration_days);
        const expiryStr = getLocalDateStr(eDate);

        const { data: newMs, error: msError } = await supabase
          .from('memberships')
          .insert({
            member_id: selectedMemberId,
            plan_id: selectedPlan.id,
            start_date: subStartDate,
            expiry_date: expiryStr,
            status: 'ACTIVE',
            visit_day_limit: selectedPlan.visit_day_limit || null,
            visit_days_used: 0,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (msError) throw msError;
        if (newMs) membershipId = newMs.id;
      }

      // Record payment
      const { error: payError } = await supabase.from('payments').insert({
        member_id: selectedMemberId,
        membership_id: membershipId,
        amount: String(amount),
        payment_method: paymentMethod,
        transaction_reference: transactionRef.trim() || null,
        received_by: user?.id || null,
        payment_date: today,
        receipt_number: receiptNumber,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (payError) throw payError;

      Alert.alert('Success', `Payment of ${formatCurrency(amount)} recorded successfully! (Receipt #${receiptNumber})`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Payment Failed', (err as Error).message || 'Unable to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="Record Payment"
      subtitle="Collect Membership Dues & Fees"
    >
      <View style={styles.form}>
        {/* Member Selector */}
        {!preselectedMemberId && (
          <View style={styles.fieldSection}>
            <Text style={styles.sectionLabel}>SELECT MEMBER *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {members.map(m => {
                const isSelected = selectedMemberId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setSelectedMemberId(m.id)}
                    style={[
                      styles.chip,
                      isSelected && styles.selectedChip,
                    ]}
                  >
                    <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                      {m.full_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Plan Selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>SELECT MEMBERSHIP PLAN (OPTIONAL)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {plans.map(p => {
              const isSelected = selectedPlanId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handlePlanSelect(p)}
                  style={[
                    styles.chip,
                    isSelected && styles.selectedChip,
                  ]}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {p.name} ({formatCurrency(p.price)})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Amount */}
        <FVEInput
          label="AMOUNT (INR) *"
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 1500"
          keyboardType="numeric"
        />

        {/* Payment Method */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>PAYMENT METHOD *</Text>
          <View style={styles.methodRow}>
            {PAYMENT_METHODS.map(method => {
              const isSelected = paymentMethod === method;
              return (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={[
                    styles.methodButton,
                    isSelected && styles.selectedMethodButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      isSelected && styles.selectedMethodButtonText,
                    ]}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Transaction Reference */}
        <FVEInput
          label="TRANSACTION REFERENCE (OPTIONAL)"
          value={transactionRef}
          onChangeText={setTransactionRef}
          placeholder="UPI ref, check no, or card tx ID"
        />

        {/* Notes */}
        <FVEInput
          label="NOTES"
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional remarks"
          multiline
        />

        <FVEButton
          title="CONFIRM PAYMENT"
          onPress={handleSubmit}
          loading={loading}
          variant="gold"
          size="lg"
          style={styles.submitButton}
        />
      </View>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingBottom: 20,
  },
  fieldSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhaniMedium,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#161A20',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  selectedChip: {
    backgroundColor: colors.goldMuted,
    borderColor: colors.gold,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  selectedChipText: {
    color: colors.gold,
    fontWeight: '700',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    backgroundColor: '#161A20',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  selectedMethodButton: {
    backgroundColor: colors.goldMuted,
    borderColor: colors.gold,
  },
  methodButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
  },
  selectedMethodButtonText: {
    color: colors.gold,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 10,
  },
});
