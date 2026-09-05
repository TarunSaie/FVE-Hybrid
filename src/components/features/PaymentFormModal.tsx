import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Search, X, Check, User } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { Member, MembershipPlan, PAYMENT_METHODS } from '@/types';
import { supabase } from '@/api/supabase';
import { getLocalDateStr } from '@/utils/date';
import { formatCurrency, generateReceiptNumber } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(preselectedMemberId || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const amountRef = useRef('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const transactionRefInput = useRef('');
  const notesRef = useRef('');

  useEffect(() => {
    if (visible) {
      // Fetch members and plans
      supabase
        .from('members')
        .select('id, full_name, mobile, member_id, joining_date')
        .then(({ data }) => {
          const list = (data || []) as Member[];
          list.sort((a, b) => {
            const aMatch = (a.member_id || '').match(/\d+/);
            const bMatch = (b.member_id || '').match(/\d+/);
            const aNum = aMatch ? parseInt(aMatch[0], 10) : 999999999;
            const bNum = bMatch ? parseInt(bMatch[0], 10) : 999999999;
            if (aNum !== bNum) return aNum - bNum;
            return (a.full_name || '').localeCompare(b.full_name || '');
          });
          setMembers(list);
        });

      supabase.from('membership_plans').select('*').eq('active', true).order('price').then(({ data }) => {
        setPlans((data || []) as MembershipPlan[]);
      });

      if (preselectedMemberId) {
        setSelectedMemberId(preselectedMemberId);
      }
      setMemberSearch('');
    }
  }, [visible, preselectedMemberId]);

  const selectedMember = useMemo(
    () => members.find(m => m.id === selectedMemberId),
    [members, selectedMemberId]
  );

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    if (!term) return members.slice(0, 10);
    return members.filter(m =>
      (m.full_name || '').toLowerCase().includes(term) ||
      (m.member_id || '').toLowerCase().includes(term) ||
      (m.mobile || '').includes(term)
    );
  }, [members, memberSearch]);

  const handlePlanSelect = (plan: MembershipPlan) => {
    setSelectedPlanId(plan.id);
    amountRef.current = String(plan.price);
  };

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      Alert.alert('Error', 'Please select a member');
      return;
    }
    if (!amountRef.current || isNaN(Number(amountRef.current)) || Number(amountRef.current) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    try {
      const today = getLocalDateStr();
      const receiptNumber = generateReceiptNumber();

      let membershipId: string | null = null;

      const memberObj = members.find(m => m.id === selectedMemberId);

      // If a plan is selected, create a membership
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
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
        amount: String(amountRef.current),
        payment_method: paymentMethod,
        transaction_reference: transactionRefInput.current.trim() || null,
        received_by: user?.id || null,
        payment_date: today,
        receipt_number: receiptNumber,
        notes: notesRef.current.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (payError) throw payError;

      // Insert in-app notifications
      try {
        const notifMsg = `${formatCurrency(amountRef.current)} received from ${memberObj?.full_name || 'Member'} for ${selectedPlan ? selectedPlan.name : 'gym dues'}.`;
        const { data: admins } = await supabase
          .from('user_profiles')
          .select('id')
          .in('role', ['OWNER', 'ADMIN']);

        const notifRows: { user_id: string; title: string; message: string; type: string }[] = [];
        const targetIds = new Set<string>();
        if (user?.id) targetIds.add(user.id);
        (admins || []).forEach(a => targetIds.add(a.id));

        targetIds.forEach(uid => {
          notifRows.push({
            user_id: uid,
            title: 'Payment Received',
            message: notifMsg,
            type: 'SUCCESS',
          });
        });

        if (notifRows.length > 0) {
          await supabase.from('notifications').insert(notifRows);
          qc.invalidateQueries({ queryKey: ['mobile-notifications'] });
          qc.invalidateQueries({ queryKey: ['unread-notifications'] });
          qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
        }
      } catch (notifErr) {
        console.warn('[PaymentFormModal] Notification error:', notifErr);
      }

      Alert.alert('Success', `Payment of ${formatCurrency(amountRef.current)} recorded successfully! (Receipt #${receiptNumber})`);
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
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>SELECT MEMBER *</Text>
          {selectedMember ? (
            <View style={styles.selectedMemberCard}>
              <View style={styles.selectedMemberAvatar}>
                <Text style={styles.selectedMemberInitial}>
                  {selectedMember.full_name?.charAt(0)?.toUpperCase() || 'M'}
                </Text>
              </View>
              <View style={styles.selectedMemberInfo}>
                <View style={styles.selectedMemberNameRow}>
                  <Text style={styles.selectedMemberName}>{selectedMember.full_name}</Text>
                  {selectedMember.member_id && (
                    <View style={styles.idBadge}>
                      <Text style={styles.idBadgeText}>{selectedMember.member_id}</Text>
                    </View>
                  )}
                </View>
                {selectedMember.mobile ? (
                  <Text style={styles.selectedMemberMobile}>📞 {selectedMember.mobile}</Text>
                ) : null}
              </View>
              {!preselectedMemberId && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMemberId('');
                    setMemberSearch('');
                  }}
                  style={styles.changeMemberBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeMemberText}>Change</Text>
                  <X size={14} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.searchMemberContainer}>
              <FVEInput
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholder="Search member by ID (e.g. FVE-25), name, phone..."
                leftIcon={<Search size={15} color={colors.gold} />}
                rightIcon={memberSearch ? <X size={15} color={colors.textSecondary} /> : undefined}
                onRightIconPress={() => setMemberSearch('')}
                containerStyle={{ marginBottom: 8 }}
              />

              <View style={styles.memberResultsBox}>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => {
                        setSelectedMemberId(m.id);
                        setMemberSearch('');
                      }}
                      style={styles.memberResultRow}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberResultLeft}>
                        <View style={styles.memberMiniAvatar}>
                          <Text style={styles.memberMiniInitial}>
                            {m.full_name?.charAt(0)?.toUpperCase() || 'M'}
                          </Text>
                        </View>
                        <View>
                          <View style={styles.memberResultNameRow}>
                            <Text style={styles.memberResultName}>{m.full_name}</Text>
                            {m.member_id && (
                              <View style={styles.idBadgeSm}>
                                <Text style={styles.idBadgeSmText}>{m.member_id}</Text>
                              </View>
                            )}
                          </View>
                          {m.mobile && (
                            <Text style={styles.memberResultMobile}>{m.mobile}</Text>
                          )}
                        </View>
                      </View>
                      <Check size={16} color="transparent" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptySearchBox}>
                    <Text style={styles.emptySearchText}>
                      No members found matching "{memberSearch}"
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

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
          defaultValue={amountRef.current}
          onChangeText={(t) => { amountRef.current = t; }}
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
          defaultValue={transactionRefInput.current}
          onChangeText={(t) => { transactionRefInput.current = t; }}
          placeholder="UPI ref, check no, or card tx ID"
        />

        {/* Notes */}
        <FVEInput
          label="NOTES"
          defaultValue={notesRef.current}
          onChangeText={(t) => { notesRef.current = t; }}
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
  selectedMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161A20',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 161, 0, 0.45)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  selectedMemberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMemberInitial: {
    color: colors.gold,
    fontSize: 16,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  selectedMemberInfo: {
    flex: 1,
  },
  selectedMemberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  selectedMemberName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  selectedMemberMobile: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  idBadge: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  idBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
  },
  changeMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  changeMemberText: {
    color: colors.error,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.interSemiBold,
  },
  searchMemberContainer: {
    marginBottom: 4,
  },
  memberResultsBox: {
    backgroundColor: '#0E1116',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.18)',
    borderRadius: 10,
    maxHeight: 200,
    overflow: 'hidden',
  },
  memberResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  memberMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1C2128',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  memberMiniInitial: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  memberResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberResultName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.interSemiBold,
  },
  memberResultMobile: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    marginTop: 1,
  },
  idBadgeSm: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.35)',
    paddingHorizontal: 5,
    paddingVertical: 0.5,
    borderRadius: 4,
  },
  idBadgeSmText: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
  },
  emptySearchBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptySearchText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
});
