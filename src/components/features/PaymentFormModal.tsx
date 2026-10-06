import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Search, X, Check, User, Calendar, Sparkles } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { Member, MembershipPlan, PAYMENT_METHODS } from '@/types';
import { supabase } from '@/api/supabase';
import {
  getLocalDateStr,
  calculateExpiryDate,
  formatDate,
  getNextDayStr,
  calculateRenewalStartDate,
} from '@/utils/date';
import { formatCurrency, generateReceiptNumber, getFriendlyErrorMessage } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { sounds } from '@/utils/sounds';
import { UPIPaymentQRCard } from '@/components/features/UPIPaymentQRCard';

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
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getPaymentFormStyles(colors, isDark), [colors, isDark]);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(preselectedMemberId || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const amountRef = useRef('');
  const [amountValue, setAmountValue] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const transactionRefInput = useRef('');
  const notesRef = useRef('');
  const [activePlanInfo, setActivePlanInfo] = useState<{
    name: string;
    expiryDate: string;
    isActive: boolean;
  } | null>(null);

  // Detect active plan whenever selected member changes
  useEffect(() => {
    if (!selectedMemberId) {
      setActivePlanInfo(null);
      return;
    }
    supabase
      .from('memberships')
      .select('id, expiry_date, status, membership_plans(name)')
      .eq('member_id', selectedMemberId)
      .in('status', ['ACTIVE', 'EXPIRING_SOON'])
      .order('expiry_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const todayStr = getLocalDateStr();
          const notExpired = !!data.expiry_date && data.expiry_date >= todayStr;
          const plan = data.membership_plans as { name?: string } | null;
          setActivePlanInfo({
            name: plan?.name || 'Active Membership',
            expiryDate: data.expiry_date,
            isActive: notExpired,
          });
        } else {
          setActivePlanInfo(null);
        }
      });
  }, [selectedMemberId]);

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
      setAmountValue('');
      amountRef.current = '';
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

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId),
    [plans, selectedPlanId]
  );

  const renewalInfo = useMemo(() => {
    if (!selectedPlan) return null;
    const today = getLocalDateStr();
    const hasUnexpiredPlan = !!(
      activePlanInfo?.isActive &&
      activePlanInfo.expiryDate &&
      activePlanInfo.expiryDate >= today
    );
    const startDate = hasUnexpiredPlan
      ? getNextDayStr(activePlanInfo.expiryDate)
      : selectedMember?.joining_date && !activePlanInfo
      ? selectedMember.joining_date
      : today;
    const expiryDate = calculateExpiryDate(startDate, selectedPlan.duration_days);
    return {
      isConsecutiveRenewal: hasUnexpiredPlan,
      startDate,
      expiryDate,
      currentExpiry: activePlanInfo?.expiryDate,
    };
  }, [selectedPlan, activePlanInfo, selectedMember]);

  const handlePlanSelect = (plan: MembershipPlan) => {
    setSelectedPlanId(plan.id);
    const priceStr = String(plan.price);
    amountRef.current = priceStr;
    setAmountValue(priceStr);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!selectedMemberId) {
      Alert.alert('Error', 'Please select a member');
      return;
    }
    if (!amountRef.current || isNaN(Number(amountRef.current)) || Number(amountRef.current) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    // If member already has an active membership into the future, inform owner about consecutive renewal
    if (renewalInfo?.isConsecutiveRenewal && selectedPlan) {
      Alert.alert(
        'Consecutive Renewal',
        `${selectedMember?.full_name || 'This member'} has an active membership (${activePlanInfo?.name}) valid until ${formatDate(activePlanInfo?.expiryDate)}.\n\nRenewal will seamlessly start the next day (${formatDate(renewalInfo.startDate)}) and run until ${formatDate(renewalInfo.expiryDate)} (${selectedPlan.duration_days} days).\n\nNo membership days will be lost. Proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Record Renewal',
            onPress: () => processPaymentSubmission(),
          },
        ]
      );
      return;
    }

    await processPaymentSubmission();
  };

  const processPaymentSubmission = async () => {
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

        // Check if member has any existing memberships
        const { data: existingMs } = await supabase
          .from('memberships')
          .select('id, start_date, expiry_date, status')
          .eq('member_id', selectedMemberId)
          .order('expiry_date', { ascending: false });

        const hasAnyMembership = (existingMs || []).length > 0;
        const unexpiredMs = (existingMs || []).find(
          m => (m.status === 'ACTIVE' || m.status === 'EXPIRING_SOON') && m.expiry_date && m.expiry_date >= today
        );

        // Consecutive renewal: starts the day after current expiry (0 days lost)
        subStartDate = calculateRenewalStartDate(
          unexpiredMs?.expiry_date,
          memberObj?.joining_date,
          hasAnyMembership
        );

        const expiryStr = calculateExpiryDate(subStartDate, selectedPlan.duration_days);

        // Expire all previous active/expiring memberships so old ones don't conflict
        await supabase
          .from('memberships')
          .update({ status: 'EXPIRED' })
          .eq('member_id', selectedMemberId)
          .in('status', ['ACTIVE', 'EXPIRING_SOON']);

        // Insert new active membership with future expiry date
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
        transaction_reference: transactionRefInput.current.trim() || '',
        received_by: user?.id || null,
        payment_date: today,
        receipt_number: receiptNumber,
        notes: notesRef.current.trim() || '',
        created_at: new Date().toISOString(),
      });

      if (payError) throw payError;

      // Invalidate queries across screens
      qc.invalidateQueries({ queryKey: ['mobile-payments'] });
      qc.invalidateQueries({ queryKey: ['mobile-members'] });
      qc.invalidateQueries({ queryKey: ['member-detail', selectedMemberId] });
      qc.invalidateQueries({ queryKey: ['member-memberships', selectedMemberId] });
      qc.invalidateQueries({ queryKey: ['member-payments', selectedMemberId] });
      qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['expiring-memberships'] });

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
          sounds.notification();
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
      Alert.alert('Payment Failed', getFriendlyErrorMessage(err, 'Unable to record payment. Please try again.'));
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
                {activePlanInfo?.isActive ? (
                  <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: colors.success, fontSize: 11, fontFamily: typography.fonts.interSemiBold }}>
                      ✓ Active Membership: {activePlanInfo.name} (Valid till {formatDate(activePlanInfo.expiryDate)})
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.25)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: colors.error, fontSize: 11, fontFamily: typography.fonts.interSemiBold }}>
                      ⚠️ Membership Expired / Renewal Due
                    </Text>
                  </View>
                )}
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

        {/* Consecutive Renewal / Plan Validity Preview Card */}
        {renewalInfo && selectedPlan && (
          <View style={[
            styles.renewalInfoCard,
            renewalInfo.isConsecutiveRenewal ? styles.consecutiveRenewalCard : styles.standardRenewalCard,
          ]}>
            <View style={styles.renewalHeaderRow}>
              <View style={styles.renewalTitleWithIcon}>
                {renewalInfo.isConsecutiveRenewal ? (
                  <Sparkles size={14} color={colors.gold} />
                ) : (
                  <Calendar size={14} color={colors.textSecondary} />
                )}
                <Text style={[
                  styles.renewalCardTitle,
                  renewalInfo.isConsecutiveRenewal && { color: colors.gold }
                ]}>
                  {renewalInfo.isConsecutiveRenewal
                    ? 'CONSECUTIVE RENEWAL APPLIED'
                    : 'MEMBERSHIP VALIDITY'}
                </Text>
              </View>
              {renewalInfo.isConsecutiveRenewal && (
                <View style={styles.zeroDaysBadge}>
                  <Text style={styles.zeroDaysBadgeText}>0 Days Lost</Text>
                </View>
              )}
            </View>

            {renewalInfo.isConsecutiveRenewal && (
              <Text style={styles.renewalSubtitle}>
                Current plan valid until {formatDate(renewalInfo.currentExpiry)}. Starts seamlessly the next day.
              </Text>
            )}

            <View style={styles.renewalPeriodRow}>
              <View style={styles.periodCol}>
                <Text style={styles.periodLabel}>STARTS</Text>
                <Text style={styles.periodValue}>{formatDate(renewalInfo.startDate)}</Text>
              </View>
              <Text style={styles.periodArrow}>→</Text>
              <View style={styles.periodCol}>
                <Text style={styles.periodLabel}>EXPIRES</Text>
                <Text style={styles.periodValue}>{formatDate(renewalInfo.expiryDate)}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{selectedPlan.duration_days}d</Text>
              </View>
            </View>
          </View>
        )}

        {/* Amount */}
        <FVEInput
          label="AMOUNT (INR) *"
          value={amountValue}
          onChangeText={(t) => {
            amountRef.current = t;
            setAmountValue(t);
          }}
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

        {/* UPI QR Payment Card */}
        {paymentMethod === 'UPI' && (
          <UPIPaymentQRCard
            amount={amountValue}
            title="FITVERSE ELITE UPI QR"
          />
        )}

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

const getPaymentFormStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
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
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    selectedChip: {
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.15)',
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
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
    },
    selectedMethodButton: {
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.15)',
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
      backgroundColor: colors.bgSecondary,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.45)' : colors.goldBorder,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    selectedMemberAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(239, 161, 0, 0.12)',
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
      flexShrink: 1,
    },
    selectedMemberMobile: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
    },
    idBadge: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(239, 161, 0, 0.12)',
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
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.12)',
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
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
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
      borderBottomColor: colors.borderDefault,
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
      backgroundColor: colors.bgTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : colors.goldBorder,
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
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : colors.goldBorder,
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
    renewalInfoCard: {
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
    },
    consecutiveRenewalCard: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.08)' : 'rgba(239, 161, 0, 0.1)',
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : colors.goldBorder,
    },
    standardRenewalCard: {
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderDefault,
    },
    renewalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    renewalTitleWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    renewalCardTitle: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.textPrimary,
    },
    zeroDaysBadge: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
      borderColor: '#10B981',
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    zeroDaysBadgeText: {
      color: '#10B981',
      fontSize: 10,
      fontWeight: '700',
      fontFamily: typography.fonts.rajdhaniMedium,
    },
    renewalSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      fontFamily: typography.fonts.inter,
      marginBottom: 8,
    },
    renewalPeriodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    periodCol: {
      flex: 1,
    },
    periodLabel: {
      fontSize: 9,
      color: colors.textSecondary,
      fontFamily: typography.fonts.inter,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    periodValue: {
      fontSize: typography.sizes.xs,
      color: colors.textPrimary,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
    },
    periodArrow: {
      color: colors.gold,
      fontSize: 14,
      fontWeight: 'bold',
    },
    durationBadge: {
      backgroundColor: colors.bgTertiary,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
    },
    durationBadgeText: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: '700',
      fontFamily: typography.fonts.rajdhaniMedium,
    },
  });
