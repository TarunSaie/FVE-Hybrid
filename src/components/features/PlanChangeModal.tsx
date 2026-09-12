import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowRight,
  CreditCard,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Send,
  Ban,
  Clock,
  Check,
  MessageCircle,
  FileText,
} from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEBadge } from '@/components/common/FVEBadge';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import {
  Member,
  Membership,
  MembershipPlan,
  PlanChangeRequest,
  PlanChangeValidityMode,
  PAYMENT_METHODS,
  Payment,
} from '@/types';
import {
  formatCurrency,
  generateReceiptNumber,
  buildPlanUpgradeWhatsAppMessage,
  openWhatsAppLink,
  getFriendlyErrorMessage,
} from '@/utils/format';
import {
  getLocalDateStr,
  formatDate,
  calculateExpiryDate,
  normalizeMembershipStatus,
} from '@/utils/date';
import { RootStackParamList } from '@/navigation/types';

interface PlanChangeModalProps {
  visible: boolean;
  onClose: () => void;
  member: Member;
  activeMembership: Membership & { membership_plans?: MembershipPlan };
  existingRequest?: PlanChangeRequest | null;
  onSuccess: () => void;
}

export function PlanChangeModal({
  visible,
  onClose,
  member,
  activeMembership,
  existingRequest,
  onSuccess,
}: PlanChangeModalProps) {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const qc = useQueryClient();
  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(user?.role || '');

  const today = getLocalDateStr();
  const currentPlan = activeMembership.membership_plans;

  // 1. Query active membership plans
  const { data: allPlans = [], isLoading: plansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ['mobile-active-plans-for-upgrade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      return (data || []).map((p) => ({
        ...p,
        price: Number(p.price) || 0,
      })) as MembershipPlan[];
    },
    enabled: visible,
  });

  // 2. Query payments linked to this active membership
  const { data: membershipPayments = [] } = useQuery<Payment[]>({
    queryKey: ['membership-payments-for-upgrade', activeMembership.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method')
        .eq('membership_id', activeMembership.id);
      if (error) {
        console.warn('Membership payments query note:', error.message);
        return [];
      }
      return (data || []) as Payment[];
    },
    enabled: visible && !!activeMembership.id,
  });

  // Calculate amount already paid for this membership
  const alreadyPaidAmount = useMemo(() => {
    if (existingRequest?.amount_already_paid != null) {
      return Number(existingRequest.amount_already_paid);
    }
    const sumPayments = membershipPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );
    if (sumPayments > 0) return sumPayments;
    // Fallback to current plan price
    return Number(currentPlan?.price || 0);
  }, [membershipPayments, currentPlan?.price, existingRequest]);

  // Target plan state
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [validityMode, setValidityMode] = useState<PlanChangeValidityMode>(
    existingRequest?.validity_mode || 'FROM_START_DATE'
  );
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');
  const [discountAdjustment, setDiscountAdjustment] = useState<string>('0');
  const [notes, setNotes] = useState<string>(existingRequest?.notes || '');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  // Payment inputs for Owner/Admin direct collection
  const [actionType, setActionType] = useState<'COLLECT' | 'REQUEST'>(
    isOwnerOrAdmin ? 'COLLECT' : 'REQUEST'
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(today);
  const [loading, setLoading] = useState<boolean>(false);

  // Prepopulate target plan
  useEffect(() => {
    if (visible && allPlans.length > 0 && !selectedPlanId) {
      if (existingRequest?.requested_plan_id) {
        setSelectedPlanId(existingRequest.requested_plan_id);
      } else {
        const otherPlan = allPlans.find((p) => p.id !== activeMembership.plan_id);
        if (otherPlan) setSelectedPlanId(otherPlan.id);
        else if (allPlans[0]) setSelectedPlanId(allPlans[0].id);
      }
    }
  }, [visible, allPlans, selectedPlanId, activeMembership.plan_id, existingRequest]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setActionType(isOwnerOrAdmin ? 'COLLECT' : 'REQUEST');
      setPaymentMethod('Cash');
      setTransactionRef('');
      setPaymentDate(today);
      setDiscountAdjustment('0');
      setShowRejectInput(false);
      setRejectionReason('');
      if (existingRequest) {
        setNotes(existingRequest.notes || '');
        setValidityMode(existingRequest.validity_mode || 'FROM_START_DATE');
        if (existingRequest.requested_plan_id) {
          setSelectedPlanId(existingRequest.requested_plan_id);
        }
      }
    }
  }, [visible, existingRequest, isOwnerOrAdmin, today]);

  const selectedPlan = useMemo(() => {
    return allPlans.find((p) => p.id === selectedPlanId) || null;
  }, [allPlans, selectedPlanId]);

  // Financial calculations
  const newPlanPrice = Number(selectedPlan?.price || 0);
  const discountNum = Math.max(0, Number(discountAdjustment) || 0);
  const calculatedDifference = Math.max(0, newPlanPrice - alreadyPaidAmount);
  const finalBalanceDue = Math.max(0, calculatedDifference - discountNum);

  // Calculated new expiry date
  const calculatedExpiry = useMemo(() => {
    if (!selectedPlan) return activeMembership.expiry_date;
    const duration = selectedPlan.duration_days;
    switch (validityMode) {
      case 'FROM_START_DATE':
        return calculateExpiryDate(activeMembership.start_date, duration);
      case 'FROM_EXPIRY':
        return calculateExpiryDate(activeMembership.expiry_date, duration);
      case 'FROM_TODAY':
        return calculateExpiryDate(today, duration);
      case 'CUSTOM':
        return customExpiryDate || calculateExpiryDate(activeMembership.start_date, duration);
      default:
        return calculateExpiryDate(activeMembership.start_date, duration);
    }
  }, [
    selectedPlan,
    validityMode,
    activeMembership.start_date,
    activeMembership.expiry_date,
    today,
    customExpiryDate,
  ]);

  // ── 1. OWNER / ADMIN APPROVE & COLLECT PAYMENT NOW ───────────────────
  const handleApproveAndCollect = async () => {
    if (!selectedPlan) {
      haptics.warning();
      Alert.alert('Required', 'Please select a new membership plan');
      return;
    }
    if (paymentMethod !== 'Cash' && finalBalanceDue > 0 && !transactionRef.trim()) {
      haptics.warning();
      Alert.alert('Required', `Transaction reference ID is required for ${paymentMethod}`);
      return;
    }

    setLoading(true);
    try {
      const receiptNumber = generateReceiptNumber();
      let createdPaymentId: string | null = null;
      let createdPaymentObj: Payment | null = null;

      // A. Record balance payment if balance > 0
      if (finalBalanceDue > 0) {
        const { data: pRecord, error: pError } = await supabase
          .from('payments')
          .insert({
            member_id: member.id,
            membership_id: activeMembership.id,
            amount: String(finalBalanceDue),
            payment_method: paymentMethod,
            transaction_reference: transactionRef.trim() || '',
            received_by: user?.id || null,
            payment_date: paymentDate,
            receipt_number: receiptNumber,
            notes:
              notes.trim() ||
              `Plan Upgrade: ${currentPlan?.name || 'Previous Plan'} → ${selectedPlan.name}. Balance payment collected.`,
          })
          .select('*, members(*), memberships(*, membership_plans(*))')
          .single();

        if (pError || !pRecord) {
          throw new Error(getFriendlyErrorMessage(pError, 'Failed to record balance payment'));
        }
        createdPaymentId = pRecord.id;
        createdPaymentObj = pRecord as Payment;
      }

      // B. Update membership record
      const newStatus = normalizeMembershipStatus('ACTIVE', calculatedExpiry) || 'ACTIVE';
      const { error: mError } = await supabase
        .from('memberships')
        .update({
          plan_id: selectedPlan.id,
          expiry_date: calculatedExpiry,
          status: newStatus,
          visit_day_limit: selectedPlan.visit_day_limit ?? null,
        })
        .eq('id', activeMembership.id);

      if (mError) {
        throw new Error(getFriendlyErrorMessage(mError, 'Failed to update membership'));
      }

      // C. Update or Insert plan_change_requests audit record
      try {
        if (existingRequest?.id) {
          await supabase
            .from('plan_change_requests')
            .update({
              requested_plan_id: selectedPlan.id,
              amount_already_paid: String(alreadyPaidAmount),
              new_plan_price: String(newPlanPrice),
              balance_amount: String(finalBalanceDue),
              validity_mode: validityMode,
              calculated_expiry_date: calculatedExpiry,
              status: 'COMPLETED',
              approved_by: user?.id,
              payment_id: createdPaymentId,
              notes: notes.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingRequest.id);
        } else {
          await supabase.from('plan_change_requests').insert({
            member_id: member.id,
            membership_id: activeMembership.id,
            current_plan_id: activeMembership.plan_id,
            requested_plan_id: selectedPlan.id,
            amount_already_paid: String(alreadyPaidAmount),
            new_plan_price: String(newPlanPrice),
            balance_amount: String(finalBalanceDue),
            validity_mode: validityMode,
            calculated_expiry_date: calculatedExpiry,
            status: 'COMPLETED',
            requested_by_role: user?.role || 'OWNER',
            requested_by: user?.id,
            approved_by: user?.id,
            payment_id: createdPaymentId,
            notes: notes.trim(),
          });
        }
      } catch (logErr) {
        console.warn('Audit record note:', logErr);
      }

      // D. Broadcast notifications
      try {
        const { data: admins } = await supabase
          .from('user_profiles')
          .select('id')
          .in('role', ['OWNER', 'ADMIN']);

        const targets = new Set<string>();
        if (user?.id) targets.add(user.id);
        (admins || []).forEach((a) => targets.add(a.id));

        const notifs = Array.from(targets).map((uid) => ({
          user_id: uid,
          title: 'Membership Plan Upgraded',
          message: `${member.full_name} upgraded to ${selectedPlan.name}. Balance of ${formatCurrency(finalBalanceDue)} collected. Valid until ${formatDate(calculatedExpiry)}.`,
          type: 'SUCCESS',
        }));
        if (notifs.length > 0) {
          await supabase.from('notifications').insert(notifs);
        }
      } catch (nErr) {
        console.warn('Notification log error:', nErr);
      }

      // Invalidate queries across screens
      qc.invalidateQueries({ queryKey: ['member-detail', member.id] });
      qc.invalidateQueries({ queryKey: ['member-memberships', member.id] });
      qc.invalidateQueries({ queryKey: ['member-payments', member.id] });
      qc.invalidateQueries({ queryKey: ['membership-payments-for-upgrade', activeMembership.id] });
      qc.invalidateQueries({ queryKey: ['plan-change-requests'] });
      qc.invalidateQueries({ queryKey: ['member-plan-change-requests', member.id] });
      qc.invalidateQueries({ queryKey: ['mobile-membership-plans'] });
      qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });

      haptics.success();

      // Completion Dialog with Action Buttons
      Alert.alert(
        'Upgrade Completed!',
        `Plan upgraded to ${selectedPlan.name}.\nBalance collected: ${formatCurrency(finalBalanceDue)}\nNew Expiry: ${formatDate(calculatedExpiry)}`,
        [
          ...(createdPaymentObj
            ? [
                {
                  text: 'View Receipt',
                  onPress: () => {
                    onSuccess();
                    onClose();
                    navigation.navigate('PaymentReceipt', {
                      payment: createdPaymentObj as Payment,
                    });
                  },
                },
              ]
            : []),
          ...(member.mobile
            ? [
                {
                  text: 'Share WhatsApp',
                  onPress: () => {
                    const message = buildPlanUpgradeWhatsAppMessage(
                      member.full_name,
                      currentPlan?.name || 'Previous Plan',
                      selectedPlan.name,
                      finalBalanceDue,
                      calculatedExpiry,
                      receiptNumber
                    );
                    openWhatsAppLink(member.mobile!, message);
                    onSuccess();
                    onClose();
                  },
                },
              ]
            : []),
          {
            text: 'Done',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to complete plan upgrade');
    } finally {
      setLoading(false);
    }
  };

  // ── 2. SUBMIT PENDING REQUEST (STAFF / RECEPTIONIST) ─────────────────
  const handleSubmitRequest = async () => {
    if (!selectedPlan) {
      haptics.warning();
      Alert.alert('Required', 'Please select a requested plan');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('plan_change_requests').insert({
        member_id: member.id,
        membership_id: activeMembership.id,
        current_plan_id: activeMembership.plan_id,
        requested_plan_id: selectedPlan.id,
        amount_already_paid: String(alreadyPaidAmount),
        new_plan_price: String(newPlanPrice),
        balance_amount: String(finalBalanceDue),
        validity_mode: validityMode,
        calculated_expiry_date: calculatedExpiry,
        status: 'PENDING',
        notes: notes.trim(),
        requested_by_role: user?.role || 'STAFF',
        requested_by: user?.id || null,
      });

      if (error) {
        throw new Error(getFriendlyErrorMessage(error, 'Unable to submit plan change request'));
      }

      // Notify Owners and Admins
      try {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('id')
          .in('role', ['OWNER', 'ADMIN']);

        if (owners && owners.length > 0) {
          const notifs = owners.map((o) => ({
            user_id: o.id,
            title: 'New Plan Upgrade Request',
            message: `${member.full_name} requested to upgrade from ${currentPlan?.name || 'Current Plan'} to ${selectedPlan.name}. Estimated balance: ${formatCurrency(finalBalanceDue)}.`,
            type: 'INFO',
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch (nErr) {
        console.warn('Staff request notification note:', nErr);
      }

      qc.invalidateQueries({ queryKey: ['plan-change-requests'] });
      qc.invalidateQueries({ queryKey: ['member-plan-change-requests', member.id] });

      haptics.success();
      Alert.alert(
        'Request Submitted',
        'Plan change request submitted successfully for owner review and approval.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  // ── 3. OWNER REJECT REQUEST ──────────────────────────────────────────
  const handleReject = async () => {
    if (!existingRequest?.id) return;
    if (!rejectionReason.trim()) {
      haptics.warning();
      Alert.alert('Required', 'Please enter a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('plan_change_requests')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason.trim(),
          approved_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['plan-change-requests'] });
      qc.invalidateQueries({ queryKey: ['member-plan-change-requests', member.id] });

      haptics.success();
      Alert.alert('Request Rejected', 'The upgrade request has been rejected.', [
        {
          text: 'OK',
          onPress: () => {
            onSuccess();
            onClose();
          },
        },
      ]);
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="PLAN UPGRADE / CHANGE"
      subtitle="Upgrade membership with automatic balance deduction"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── CURRENT MEMBERSHIP HEADER CARD ── */}
        <View style={styles.memberCard}>
          <View style={styles.memberHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>{member.full_name}</Text>
                {member.member_id ? (
                  <View style={styles.memberIdBadge}>
                    <Text style={styles.memberIdText}>{member.member_id}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.memberSubText}>
                Active: <Text style={styles.whiteBold}>{currentPlan?.name || 'Standard Plan'}</Text>{' '}
                · Valid {formatDate(activeMembership.start_date)} →{' '}
                <Text style={styles.greenText}>{formatDate(activeMembership.expiry_date)}</Text>
              </Text>
            </View>
            <View style={styles.paidColumn}>
              <Text style={styles.paidLabel}>PAID FOR PLAN</Text>
              <Text style={styles.paidValue}>{formatCurrency(alreadyPaidAmount)}</Text>
            </View>
          </View>
        </View>

        {/* ── TARGET PLAN SELECTION ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <TrendingUp size={14} color={colors.gold} />
            <Text style={styles.sectionTitle}>SELECT NEW MEMBERSHIP PLAN *</Text>
          </View>

          {plansLoading ? (
            <Text style={styles.loadingText}>Loading available plans...</Text>
          ) : (
            <View style={styles.plansGrid}>
              {allPlans.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                const isCurrent = plan.id === activeMembership.plan_id;
                const isHigher = Number(plan.price) >= alreadyPaidAmount;
                const diff = Math.max(0, Number(plan.price) - alreadyPaidAmount);

                return (
                  <TouchableOpacity
                    key={plan.id}
                    onPress={() => {
                      haptics.selection();
                      setSelectedPlanId(plan.id);
                    }}
                    style={[
                      styles.planOptionCard,
                      isSelected && styles.planOptionCardSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.planCardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.planOptionName,
                              isSelected && { color: colors.gold },
                            ]}
                          >
                            {plan.name}
                          </Text>
                          {isCurrent && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>Current</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.planOptionDuration}>
                          {plan.duration_days} Days Validity
                          {plan.visit_day_limit ? ` · ${plan.visit_day_limit} visits` : ''}
                        </Text>
                      </View>
                      <Text style={styles.planOptionPrice}>{formatCurrency(plan.price)}</Text>
                    </View>

                    {/* Difference Pill */}
                    <View style={styles.diffRow}>
                      <Text style={styles.diffLabel}>Difference to pay:</Text>
                      <Text
                        style={[
                          styles.diffAmount,
                          isHigher ? { color: colors.gold } : { color: colors.success },
                        ]}
                      >
                        {isHigher ? `+ ${formatCurrency(diff)}` : 'No extra charge'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── FINANCIAL CALCULATION BREAKDOWN ── */}
        {selectedPlan && (
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeaderRow}>
              <CreditCard size={14} color={colors.gold} />
              <Text style={styles.breakdownTitle}>FINANCIAL BREAKDOWN</Text>
            </View>

            <View style={styles.breakdownLine}>
              <Text style={styles.breakdownLabel}>Target Plan Price ({selectedPlan.name}):</Text>
              <Text style={styles.breakdownVal}>{formatCurrency(newPlanPrice)}</Text>
            </View>

            <View style={styles.breakdownLine}>
              <Text style={styles.breakdownLabel}>
                Less: Amount Already Paid ({currentPlan?.name || 'Current'}):
              </Text>
              <Text style={[styles.breakdownVal, { color: colors.success }]}>
                - {formatCurrency(alreadyPaidAmount)}
              </Text>
            </View>

            {isOwnerOrAdmin && (
              <View style={[styles.breakdownLine, { alignItems: 'center' }]}>
                <Text style={styles.breakdownLabel}>Additional Discount / Adjustment:</Text>
                <View style={styles.discountInputWrap}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>₹</Text>
                  <TextInput
                    value={discountAdjustment}
                    onChangeText={setDiscountAdjustment}
                    keyboardType="numeric"
                    style={styles.discountInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            )}

            <View style={styles.balanceLine}>
              <Text style={styles.balanceLabel}>REMAINING BALANCE PAYABLE:</Text>
              <Text style={styles.balanceAmount}>{formatCurrency(finalBalanceDue)}</Text>
            </View>
          </View>
        )}

        {/* ── VALIDITY CALCULATION MODES ── */}
        {selectedPlan && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Calendar size={14} color={colors.gold} />
              <Text style={styles.sectionTitle}>VALIDITY CALCULATION RULE</Text>
            </View>

            <View style={styles.validityButtonsRow}>
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setValidityMode('FROM_START_DATE');
                }}
                style={[
                  styles.validityButton,
                  validityMode === 'FROM_START_DATE' && styles.validityButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.validityBtnTitle,
                    validityMode === 'FROM_START_DATE' && styles.validityBtnTitleActive,
                  ]}
                >
                  From Start Date
                </Text>
                <Text style={styles.validityBtnSubtitle}>
                  {selectedPlan.duration_days} days from start
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setValidityMode('FROM_EXPIRY');
                }}
                style={[
                  styles.validityButton,
                  validityMode === 'FROM_EXPIRY' && styles.validityButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.validityBtnTitle,
                    validityMode === 'FROM_EXPIRY' && styles.validityBtnTitleActive,
                  ]}
                >
                  Extend Expiry
                </Text>
                <Text style={styles.validityBtnSubtitle}>
                  +{selectedPlan.duration_days} days to expiry
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setValidityMode('FROM_TODAY');
                }}
                style={[
                  styles.validityButton,
                  validityMode === 'FROM_TODAY' && styles.validityButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.validityBtnTitle,
                    validityMode === 'FROM_TODAY' && styles.validityBtnTitleActive,
                  ]}
                >
                  Fresh Today
                </Text>
                <Text style={styles.validityBtnSubtitle}>
                  Starts today for {selectedPlan.duration_days}d
                </Text>
              </TouchableOpacity>
            </View>

            {/* Validity Preview Badge */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Resulting Validity:</Text>
              <Text style={styles.previewDate}>
                {formatDate(
                  validityMode === 'FROM_TODAY' ? today : activeMembership.start_date
                )}{' '}
                → <Text style={{ color: colors.success }}>{formatDate(calculatedExpiry)}</Text>
              </Text>
            </View>
          </View>
        )}

        {/* ── OWNER ACTION CHOICE TOGGLE ── */}
        {isOwnerOrAdmin && (
          <View style={styles.actionToggleRow}>
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setActionType('COLLECT');
              }}
              style={[
                styles.actionToggleBtn,
                actionType === 'COLLECT' && styles.actionToggleBtnGold,
              ]}
            >
              <CreditCard
                size={13}
                color={actionType === 'COLLECT' ? colors.background : colors.textMuted}
              />
              <Text
                style={[
                  styles.actionToggleText,
                  actionType === 'COLLECT' && styles.actionToggleTextDark,
                ]}
              >
                Collect & Upgrade Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setActionType('REQUEST');
              }}
              style={[
                styles.actionToggleBtn,
                actionType === 'REQUEST' && styles.actionToggleBtnBlue,
              ]}
            >
              <Clock
                size={13}
                color={actionType === 'REQUEST' ? '#FFFFFF' : colors.textMuted}
              />
              <Text
                style={[
                  styles.actionToggleText,
                  actionType === 'REQUEST' && { color: '#FFFFFF' },
                ]}
              >
                Save as Pending
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PAYMENT FIELDS (WHEN COLLECTING DIRECTLY) ── */}
        {isOwnerOrAdmin && actionType === 'COLLECT' && finalBalanceDue > 0 && (
          <View style={styles.paymentSection}>
            <View style={styles.sectionHeaderRow}>
              <CreditCard size={14} color={colors.gold} />
              <Text style={styles.sectionTitle}>BALANCE PAYMENT DETAILS</Text>
            </View>

            {/* Payment Method Chips */}
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => {
                const isSelected = paymentMethod === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      haptics.selection();
                      setPaymentMethod(m);
                    }}
                    style={[
                      styles.methodButton,
                      isSelected && styles.methodButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodButtonText,
                        isSelected && styles.methodButtonTextSelected,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {paymentMethod !== 'Cash' && (
              <FVEInput
                label="TRANSACTION REFERENCE / UTR *"
                value={transactionRef}
                onChangeText={setTransactionRef}
                placeholder="UPI ref, Card last 4, Bank UTR"
              />
            )}
          </View>
        )}

        {/* ── NOTES / REMARKS ── */}
        <FVEInput
          label="REMARKS / NOTES (OPTIONAL)"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Upgraded after trial week; member very pleased."
        />

        {/* ── OWNER REJECTION ACCORDION ── */}
        {existingRequest && isOwnerOrAdmin && (
          <View style={styles.rejectSection}>
            {!showRejectInput ? (
              <TouchableOpacity
                onPress={() => setShowRejectInput(true)}
                style={styles.rejectTriggerBtn}
              >
                <Ban size={14} color={colors.error} />
                <Text style={styles.rejectTriggerText}>Reject this upgrade request</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectTitle}>REASON FOR REJECTION *</Text>
                <TextInput
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Enter reason for rejecting request..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.rejectInput}
                />
                <View style={styles.rejectActionsRow}>
                  <FVEButton
                    title="Confirm Rejection"
                    onPress={handleReject}
                    variant="danger"
                    size="sm"
                    loading={loading}
                    disabled={!rejectionReason.trim()}
                  />
                  <FVEButton
                    title="Cancel"
                    onPress={() => setShowRejectInput(false)}
                    variant="outline"
                    size="sm"
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── MAIN SUBMIT / APPROVE BUTTON ── */}
        <View style={styles.footerActions}>
          {isOwnerOrAdmin && actionType === 'COLLECT' ? (
            <FVEButton
              title={
                loading
                  ? 'Processing Upgrade...'
                  : finalBalanceDue > 0
                  ? `Collect ${formatCurrency(finalBalanceDue)} & Upgrade`
                  : 'Approve & Upgrade Plan'
              }
              onPress={handleApproveAndCollect}
              variant="gold"
              loading={loading}
              disabled={loading || !selectedPlan}
            />
          ) : (
            <FVEButton
              title={loading ? 'Submitting Request...' : 'Submit Plan Change Request'}
              onPress={handleSubmitRequest}
              variant="blue"
              loading={loading}
              disabled={loading || !selectedPlan}
            />
          )}
        </View>
      </ScrollView>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 30,
  },
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    padding: 14,
    marginBottom: 16,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 16,
    color: colors.textPrimary,
  },
  memberIdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  memberIdText: {
    fontFamily: typography.fonts.inter,
    fontSize: 10,
    color: colors.gold,
    fontWeight: '700',
  },
  memberSubText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  whiteBold: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  greenText: {
    color: colors.success,
    fontWeight: '600',
  },
  paidColumn: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 10,
  },
  paidLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
  paidValue: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 15,
    color: colors.gold,
    marginTop: 2,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 12,
  },
  plansGrid: {
    gap: 8,
  },
  planOptionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  planOptionCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(239, 161, 0, 0.08)',
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planOptionName: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 14,
    color: colors.textPrimary,
  },
  currentBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentBadgeText: {
    fontSize: 9,
    color: colors.textMuted,
  },
  planOptionDuration: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  planOptionPrice: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 14,
    color: colors.textPrimary,
  },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  diffLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  diffAmount: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 12,
  },
  breakdownCard: {
    backgroundColor: 'rgba(239, 161, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  breakdownTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  breakdownLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  breakdownVal: {
    fontFamily: typography.fonts.inter,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  discountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountInput: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: typography.fonts.inter,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
    padding: 0,
  },
  balanceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 161, 0, 0.25)',
    paddingTop: 8,
    marginTop: 4,
  },
  balanceLabel: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 12,
    color: colors.textPrimary,
  },
  balanceAmount: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 18,
    color: colors.gold,
  },
  validityButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  validityButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
  },
  validityButtonActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
  },
  validityBtnTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 10,
    color: colors.textMuted,
  },
  validityBtnTitleActive: {
    color: colors.gold,
  },
  validityBtnSubtitle: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  previewDate: {
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionToggleBtnGold: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  actionToggleBtnBlue: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  actionToggleText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.textMuted,
  },
  actionToggleTextDark: {
    color: colors.background,
  },
  paymentSection: {
    marginBottom: 16,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  methodButtonSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
  },
  methodButtonText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    color: colors.textMuted,
  },
  methodButtonTextSelected: {
    color: colors.gold,
  },
  rejectSection: {
    marginBottom: 16,
  },
  rejectTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  rejectTriggerText: {
    fontSize: 12,
    color: colors.error,
    textDecorationLine: 'underline',
  },
  rejectBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  rejectTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.error,
  },
  rejectInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    color: colors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rejectActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  footerActions: {
    marginTop: 8,
  },
});
