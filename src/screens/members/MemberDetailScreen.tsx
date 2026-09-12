import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import {
  Phone,
  Mail,
  Calendar,
  CreditCard,
  UserCheck,
  Edit,
  Trash2,
  Share2,
  Droplet,
  MapPin,
  Clock,
  Dumbbell,
  PauseCircle,
  PlayCircle,
  Cake,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Apple,
  Flame,
  Droplets,
  Lock,
  ChevronDown,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEModal } from '@/components/common/FVEModal';
import { MemberFormModal } from '@/components/features/MemberFormModal';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { AttendanceCalendarModal } from '@/components/features/AttendanceCalendarModal';
import { WorkoutPlanModal } from '@/components/features/WorkoutPlanModal';
import { PTRequestModal } from '@/components/features/PTRequestModal';
import { PTAssignmentModal } from '@/components/features/PTAssignmentModal';
import { PTPaymentModal } from '@/components/features/PTPaymentModal';
import { PTSessionModal } from '@/components/features/PTSessionModal';
import { PlanChangeModal } from '@/components/features/PlanChangeModal';
import { DietPlanModal } from '@/components/features/DietPlanModal';
import {
  Member,
  Membership,
  Payment,
  Attendance,
  WorkoutPlan,
  PersonalTraining,
  PTSession,
  PlanChangeRequest,
  DietPlan,
  DayOfWeek,
  DAYS_OF_WEEK,
} from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDate, calculateAge, getLocalDateStr } from '@/utils/date';
import {
  formatCurrency,
  openWhatsAppLink,
  buildExpiredAlertMessage,
  buildDailyDietPlanWhatsAppMessage,
  buildWeeklyDietPlanOverviewWhatsAppMessage,
  getTodayDayOfWeek,
} from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { cleanupPTNotifications } from '@/utils/personalTraining';
import { RootStackParamList } from '@/navigation/types';
import * as Clipboard from 'expo-clipboard';
import {
  buildMemberPdfData,
  shareMemberPassPdf,
  buildMemberSubscriptionClipboardText,
} from '@/utils/memberPdf';
import { buildReceiptDataFromPayment, sharePdfReceipt } from '@/utils/receiptPdf';

type DetailRouteProp = RouteProp<RootStackParamList, 'MemberDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function MemberDetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();
  const { memberId, initialMember } = route.params;

  const { user } = useAuth();
  const dialog = useDialog();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showPTRequestModal, setShowPTRequestModal] = useState(false);
  const [showPTAssignModal, setShowPTAssignModal] = useState(false);
  const [showPTPayModal, setShowPTPayModal] = useState(false);
  const [showPTSessionModal, setShowPTSessionModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [selectedDietDayPreview, setSelectedDietDayPreview] = useState<DayOfWeek>(getTodayDayOfWeek());
  const [showDietShareModal, setShowDietShareModal] = useState(false);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [selectedPlanChangeRequest, setSelectedPlanChangeRequest] = useState<PlanChangeRequest | null>(null);
  const [ptSessionModalMode, setPtSessionModalMode] = useState<'schedule' | 'complete'>('schedule');
  const [activePTSession, setActivePTSession] = useState<PTSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch Member Details
  const { data: member, refetch } = useQuery({
    queryKey: ['member-detail', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();
      if (error) throw error;
      return data as Member;
    },
    initialData: initialMember as Member | undefined,
  });

  // Fetch Member Memberships
  const { data: memberships } = useQuery({
    queryKey: ['member-memberships', memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from('memberships')
        .select('*, membership_plans(*)')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      return (data || []) as Membership[];
    },
  });

  // Fetch Member Payments
  const { data: payments } = useQuery({
    queryKey: ['member-payments', memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from('payments')
        .select('*, memberships(*, membership_plans(*))')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as Payment[];
    },
  });

  // Fetch Member Attendance
  const { data: attendanceLogs } = useQuery({
    queryKey: ['member-attendance', memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('member_id', memberId)
        .order('date', { ascending: false })
        .limit(15);
      return (data || []) as Attendance[];
    },
  });

  // Fetch Member Workout Plans
  const { data: workouts } = useQuery({
    queryKey: ['member-workouts', memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      return (data || []) as WorkoutPlan[];
    },
  });

  // Fetch Personal Training Add-on
  const { data: personalTraining, refetch: refetchPT } = useQuery({
    queryKey: ['member-pt', memberId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('personal_training')
          .select('*, trainer:user_profiles!personal_training_trainer_id_fkey(*), members(*)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') {
          console.warn('Personal training query note:', error.message);
          return null;
        }
        return data as PersonalTraining | null;
      } catch (err) {
        console.warn('Personal training query error:', err);
        return null;
      }
    },
  });

  // Fetch PT Sessions
  const { data: ptSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['member-pt-sessions', personalTraining?.id],
    queryFn: async () => {
      if (!personalTraining?.id) return [];
      try {
        const { data, error } = await supabase
          .from('pt_sessions')
          .select('*, trainer:user_profiles!pt_sessions_trainer_id_fkey(*)')
          .eq('personal_training_id', personalTraining.id)
          .order('session_date', { ascending: false });
        if (error) {
          console.warn('PT sessions query note:', error.message);
          return [];
        }
        return data as PTSession[];
      } catch (err) {
        console.warn('PT sessions query error:', err);
        return [];
      }
    },
    enabled: !!personalTraining?.id,
  });

  // Fetch Member Diet Plan
  const { data: memberDietPlan, refetch: refetchDietPlan } = useQuery<DietPlan | null>({
    queryKey: ['member-diet-plan', memberId],
    queryFn: async () => {
      if (!memberId) return null;
      try {
        const { data, error } = await supabase
          .from('diet_plans')
          .select('*, trainer:user_profiles!diet_plans_trainer_id_fkey(*), personal_training(*)')
          .eq('member_id', memberId)
          .eq('status', 'ACTIVE')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') {
          console.warn('Member diet plan query note:', error.message);
          return null;
        }
        return data as DietPlan | null;
      } catch (err) {
        console.warn('Member diet plan query error:', err);
        return null;
      }
    },
    enabled: !!memberId,
  });

  const handleSendWhatsAppDiet = async (targetDay?: DayOfWeek) => {
    if (!memberDietPlan) return;
    const memberName = member?.full_name || 'Member';
    const mobile = member?.mobile;
    if (!mobile) {
      Alert.alert('No Mobile Number', `${memberName} does not have a registered mobile number for WhatsApp.`);
      return;
    }
    const coachName = memberDietPlan.trainer?.full_name || user?.full_name || 'Team FitVerse Elite';
    const msg = buildDailyDietPlanWhatsAppMessage(memberName, memberDietPlan, coachName, targetDay);
    await openWhatsAppLink(mobile, msg);
  };

  const handleSendWhatsAppFullWeekDiet = async () => {
    if (!memberDietPlan) return;
    const memberName = member?.full_name || 'Member';
    const mobile = member?.mobile;
    if (!mobile) {
      Alert.alert('No Mobile Number', `${memberName} does not have a registered mobile number for WhatsApp.`);
      return;
    }
    const coachName = memberDietPlan.trainer?.full_name || user?.full_name || 'Team FitVerse Elite';
    const msg = buildWeeklyDietPlanOverviewWhatsAppMessage(memberName, memberDietPlan, coachName);
    await openWhatsAppLink(mobile, msg);
  };

  // Fetch Member Plan Change Requests
  const { data: memberPlanChangeRequests = [] } = useQuery<PlanChangeRequest[]>({
    queryKey: ['member-plan-change-requests', memberId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('plan_change_requests')
          .select(
            '*, members(*), memberships(*, membership_plans(*)), current_plan:membership_plans!current_plan_id(*), requested_plan:membership_plans!requested_plan_id(*), approver:user_profiles!approved_by(*)'
          )
          .eq('member_id', memberId)
          .order('created_at', { ascending: false });
        if (error) {
          console.warn('Member plan change query note:', error.message);
          return [];
        }
        return (data as unknown as PlanChangeRequest[]) || [];
      } catch (err) {
        console.warn('Member plan change query error:', err);
        return [];
      }
    },
  });

  const pendingPlanChangeRequest = memberPlanChangeRequests.find(
    (r) => r.status === 'PENDING'
  );

  const activeMembership =
    memberships?.find(m => m.status === 'ACTIVE' || m.status === 'EXPIRING_SOON') ||
    memberships?.[0];
  const initial = member?.full_name?.charAt(0)?.toUpperCase() || '?';

  const onRefresh = async () => {
    haptics.light();
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchPT(),
      refetchSessions(),
      qc.invalidateQueries({ queryKey: ['member-memberships', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-payments', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-attendance', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-workouts', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-pt', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-pt-sessions', personalTraining?.id] }),
      qc.invalidateQueries({ queryKey: ['member-plan-change-requests', memberId] }),
    ]);
    setRefreshing(false);
  };

  const handleToggleHold = async () => {
    if (!activeMembership) return;
    const isCurrentlyHold = activeMembership.status === 'HOLD';
    const newStatus = isCurrentlyHold ? 'ACTIVE' : 'HOLD';
    const actionLabel = isCurrentlyHold ? 'Reactivate' : 'Put on Hold';

    Alert.alert(
      `${actionLabel} Membership`,
      `Are you sure you want to ${actionLabel.toLowerCase()} the membership for ${member?.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('memberships')
                .update({ status: newStatus })
                .eq('id', activeMembership.id);
              if (error) throw error;
              haptics.success();
              qc.invalidateQueries({ queryKey: ['member-memberships', memberId] });
              qc.invalidateQueries({ queryKey: ['mobile-members'] });
              qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
              qc.invalidateQueries({ queryKey: ['mobile-dashboard-hold-members'] });
            } catch (err: unknown) {
              haptics.error();
              Alert.alert('Error', (err as Error).message || 'Failed to update status');
            }
          },
        },
      ]
    );
  };

  const handleCancelPT = () => {
    if (!personalTraining) return;
    const isPaid = !!personalTraining.payment_id;
    const memberName = member?.full_name || 'Member';
    const confirmMsg = isPaid
      ? `Cancel Personal Training for ${memberName}?\n\nThis will DELETE the Personal Training add-on payment (${formatCurrency(personalTraining.price || 0)}) and remove all scheduled sessions.`
      : `Cancel this Personal Training request for ${memberName}?`;

    dialog.danger(
      'Cancel Personal Training',
      confirmMsg,
      isPaid ? 'Yes, Cancel & Refund' : 'Yes, Cancel Request',
      async () => {
        try {
          if (personalTraining.payment_id) {
            await supabase.from('payments').delete().eq('id', personalTraining.payment_id);
          }
          await supabase.from('pt_sessions').delete().eq('personal_training_id', personalTraining.id);
          const { error } = await supabase.from('personal_training').delete().eq('id', personalTraining.id);
          if (error) throw error;

          // Remove all notifications related to this specific member's Personal Training
          await cleanupPTNotifications(memberId, memberName);

          haptics.success();
          refetchPT();
          refetchSessions();
          qc.invalidateQueries({ queryKey: ['member-pt', memberId] });
          qc.invalidateQueries({ queryKey: ['member-payments', memberId] });
          qc.invalidateQueries({ queryKey: ['mobile-payments'] });
          qc.invalidateQueries({ queryKey: ['mobile-pt-list'] });
          qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
          qc.invalidateQueries({ queryKey: ['notifications'] });
          qc.invalidateQueries({ queryKey: ['notifications-unread'] });

          setTimeout(() => {
            dialog.alert('Cancelled', 'Personal Training cancelled and payment removed.');
          }, 200);
        } catch (err: unknown) {
          haptics.error();
          setTimeout(() => {
            dialog.alert('Error', (err as Error).message || 'Failed to cancel');
          }, 200);
        }
      },
      'Keep Program'
    );
  };

  const handleDelete = () => {
    haptics.heavy();
    dialog.danger(
      'Delete Member',
      `Are you sure you want to remove ${member?.full_name}? This cannot be undone.`,
      'Delete',
      async () => {
        try {
          await cleanupPTNotifications(memberId, member?.full_name);
          const { error } = await supabase
            .from('members')
            .delete()
            .eq('id', memberId);
          if (error) throw error;
          haptics.success();
          qc.invalidateQueries({ queryKey: ['mobile-members'] });
          qc.invalidateQueries({ queryKey: ['notifications'] });
          qc.invalidateQueries({ queryKey: ['notifications-unread'] });
          navigation.goBack();
        } catch (err: unknown) {
          haptics.error();
          setTimeout(() => {
            dialog.alert('Error', (err as Error).message || 'Failed to delete');
          }, 200);
        }
      }
    );
  };

  const handleCall = () => {
    if (member?.mobile) {
      haptics.light();
      Linking.openURL(`tel:${member.mobile}`);
    }
  };

  const todayStr = getLocalDateStr();
  const isMemberExpired =
    !activeMembership ||
    activeMembership.status === 'EXPIRED' ||
    (!!activeMembership?.expiry_date && activeMembership.expiry_date < todayStr);
  const canCollectPayment = isMemberExpired;

  const handleWhatsApp = () => {
    if (member?.mobile) {
      haptics.medium();
      const msg = isMemberExpired
        ? buildExpiredAlertMessage(
            member.full_name,
            activeMembership?.membership_plans?.name,
            activeMembership?.expiry_date
          )
        : `Hi ${member.full_name}, greetings from FitVerse Elite!`;
      openWhatsAppLink(member.mobile, msg);
    }
  };

  const handleNativeShare = async () => {
    if (!member) return;
    haptics.medium();

    const hasPayment = payments && payments.length > 0;
    if (hasPayment) {
      Alert.alert(
        'Share Member Document',
        `Choose which document to share for ${member.full_name}:`,
        [
          {
            text: '📄 Member Pass (PDF)',
            onPress: async () => {
              try {
                // Copy subscription details to clipboard
                const clipboardText = buildMemberSubscriptionClipboardText(member, activeMembership);
                await Clipboard.setStringAsync(clipboardText);

                const pdfData = buildMemberPdfData(member, activeMembership);
                await shareMemberPassPdf(pdfData);
              } catch (err: unknown) {
                const msg = (err as Error)?.message || '';
                if (!msg.includes('Another share request')) {
                  haptics.error();
                  Alert.alert('Error', msg || 'Failed to share Member Pass PDF');
                }
              }
            },
          },
          {
            text: '🧾 Latest Receipt (PDF)',
            onPress: async () => {
              try {
                const latestPayment = payments[0];
                const receiptData = buildReceiptDataFromPayment(latestPayment);
                const startDate = latestPayment.memberships?.start_date ? formatDate(latestPayment.memberships.start_date) : null;
                const endDate = latestPayment.memberships?.expiry_date ? formatDate(latestPayment.memberships.expiry_date) : null;
                const validityLine = startDate && endDate ? `Validity: ${startDate} TO ${endDate}\n` : '';
                const receiptText =
                  `*FitVerse Elite Official Receipt*\n` +
                  `Receipt No: #${receiptData.receiptNumber}\n` +
                  `Member: ${receiptData.memberName}${receiptData.memberId ? ` (${receiptData.memberId})` : ''}\n` +
                  `Plan: ${receiptData.planName}\n` +
                  validityLine +
                  `Amount Paid: ${formatCurrency(receiptData.amount)}\n` +
                  `Payment Method: ${receiptData.paymentMethod}\n` +
                  `Date: ${receiptData.paymentDate}\n\n` +
                  `*DISCIPLINE • STRENGTH • TRANSFORMATION*\n` +
                  `FitVerse Elite Gym Management\n` +
                  `Powered by Chirvex (https://chirvex.in/)`;
                await Clipboard.setStringAsync(receiptText);

                await sharePdfReceipt(receiptData);
              } catch (err: unknown) {
                const msg = (err as Error)?.message || '';
                if (!msg.includes('Another share request')) {
                  haptics.error();
                  Alert.alert('Error', msg || 'Failed to share Receipt PDF');
                }
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      try {
        const clipboardText = buildMemberSubscriptionClipboardText(member, activeMembership);
        await Clipboard.setStringAsync(clipboardText);

        const pdfData = buildMemberPdfData(member, activeMembership);
        await shareMemberPassPdf(pdfData);
      } catch (err: unknown) {
        const msg = (err as Error)?.message || '';
        if (!msg.includes('Another share request')) {
          haptics.error();
          Alert.alert('Error', msg || 'Failed to share Member Pass PDF');
        }
      }
    }
  };

  const isBirthdayToday = member?.date_of_birth ? (() => {
    const parts = member.date_of_birth.split('-');
    if (parts.length >= 3) {
      const todayDate = new Date();
      return (todayDate.getMonth() + 1) === parseInt(parts[1], 10) && todayDate.getDate() === parseInt(parts[2], 10);
    }
    return false;
  })() : false;

  return (
    <View style={styles.container}>
      <FVEHeader
        title="MEMBER PROFILE"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleNativeShare}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.7}
            >
              <Share2 size={16} color={colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setShowEditModal(true);
              }}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.7}
            >
              <Edit size={16} color={colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={[styles.headerIconBtn, styles.headerDeleteBtn]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            {member?.profile_photo ? (
              <Image
                source={{ uri: member.profile_photo }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.fallbackAvatar}>
                <Text style={styles.fallbackText}>{initial}</Text>
              </View>
            )}

            <View style={styles.profileInfo}>
              <View style={styles.nameBadgeRow}>
                <Text numberOfLines={1} style={styles.memberName}>
                  {member?.full_name}
                </Text>
                {member?.member_id && (
                  <View style={styles.idBadge}>
                    <Text style={styles.idBadgeText}>{member.member_id}</Text>
                  </View>
                )}
              </View>

              {isBirthdayToday && (
                <View style={styles.birthdayBadge}>
                  <Cake size={13} color={colors.gold} />
                  <Text style={styles.birthdayBadgeText}>🎂 Birthday Today!</Text>
                </View>
              )}

              <FVEBadge
                status={activeMembership?.status || 'NONE'}
                size="sm"
                style={styles.statusBadge}
              />

              <Text style={styles.joinedText}>
                Joined: {formatDate(member?.joining_date)}
              </Text>
            </View>
          </View>

          {/* Quick Contact & Payment Actions */}
          <View style={styles.contactButtonsRow}>
            {member?.mobile && (
              <>
                <TouchableOpacity onPress={handleCall} style={styles.contactBtn}>
                  <Phone size={14} color={colors.gold} />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleWhatsApp}
                  style={[styles.contactBtn, styles.whatsappBtn]}
                >
                  <MessageCircle size={14} color="#25D366" />
                  <Text style={[styles.contactBtnText, { color: '#25D366' }]}>
                    {isMemberExpired ? 'WhatsApp Alert' : 'WhatsApp'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Collect Payment / Payment Completed Button */}
            <TouchableOpacity
              onPress={() => {
                if (canCollectPayment) {
                  haptics.medium();
                  setShowPaymentModal(true);
                }
              }}
              disabled={!canCollectPayment}
              style={[
                styles.contactBtn,
                canCollectPayment ? styles.collectPayBtn : styles.payCompletedBtn,
              ]}
              activeOpacity={canCollectPayment ? 0.7 : 1}
            >
              <CreditCard
                size={14}
                color={canCollectPayment ? '#00E5FF' : colors.textMuted}
              />
              <Text
                style={[
                  styles.contactBtnText,
                  { color: canCollectPayment ? '#00E5FF' : colors.textMuted },
                ]}
              >
                {canCollectPayment ? 'Collect Payment' : 'Payment Completed'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Info Grid */}
          <View style={styles.infoGrid}>
            {member?.date_of_birth ? (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>BIRTHDAY</Text>
                <Text style={styles.infoValue}>
                  {formatDate(member.date_of_birth)}
                  {member.age ? ` (${member.age}y)` : ''}
                </Text>
              </View>
            ) : member?.age ? (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>AGE</Text>
                <Text style={styles.infoValue}>{member.age} yrs</Text>
              </View>
            ) : null}
            {member?.gender && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>GENDER</Text>
                <Text style={styles.infoValue}>{member.gender}</Text>
              </View>
            )}
            {member?.blood_group && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>BLOOD GROUP</Text>
                <Text style={styles.infoValue}>{member.blood_group}</Text>
              </View>
            )}
            {member?.height && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>HEIGHT</Text>
                <Text style={styles.infoValue}>{member.height}</Text>
              </View>
            )}
            {member?.weight && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>WEIGHT</Text>
                <Text style={styles.infoValue}>{member.weight}</Text>
              </View>
            )}
          </View>
        </View>

        {/* QR Code Card */}
        {member?.qr_code && (
          <View style={styles.qrCard}>
            <Text style={styles.cardHeaderTitle}>ENTRANCE CHECK-IN QR</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={member.qr_code}
                size={160}
                color={colors.gold}
                backgroundColor="#0A0A0A"
              />
            </View>
            <Text style={styles.qrCodeText}>{member.qr_code}</Text>
            <Text style={styles.qrSubtitle}>
              Scan at front-desk kiosk for attendance check-in
            </Text>
          </View>
        )}

        {/* Active Membership Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardHeaderTitle}>CURRENT SUBSCRIPTION</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {activeMembership && (
                <TouchableOpacity
                  onPress={handleToggleHold}
                  style={[
                    styles.holdToggleBtn,
                    activeMembership.status === 'HOLD'
                      ? styles.reactivateToggleBtn
                      : styles.pauseToggleBtn,
                  ]}
                  activeOpacity={0.8}
                >
                  {activeMembership.status === 'HOLD' ? (
                    <>
                      <PlayCircle size={13} color={colors.success} />
                      <Text style={[styles.holdToggleText, { color: colors.success }]}>
                        Reactivate
                      </Text>
                    </>
                  ) : (
                    <>
                      <PauseCircle size={13} color="#FBBF24" />
                      <Text style={[styles.holdToggleText, { color: '#FBBF24' }]}>
                        Hold
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (canCollectPayment) {
                    haptics.medium();
                    setShowPaymentModal(true);
                  }
                }}
                disabled={!canCollectPayment}
                style={[
                  styles.newPayLink,
                  !canCollectPayment && styles.disabledPayLink,
                ]}
                activeOpacity={canCollectPayment ? 0.7 : 1}
              >
                <CreditCard
                  size={14}
                  color={canCollectPayment ? colors.gold : colors.textMuted}
                />
                <Text
                  style={[
                    styles.newPayLinkText,
                    !canCollectPayment && styles.disabledPayLinkText,
                  ]}
                >
                  {canCollectPayment ? '+ Collect Payment' : 'Payment Completed'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeMembership ? (
            <View>
              {pendingPlanChangeRequest && (
                <View style={styles.pendingUpgradeBanner}>
                  <View style={styles.pendingUpgradeHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} color={colors.warning} />
                      <Text style={styles.pendingUpgradeTitle}>PENDING PLAN UPGRADE</Text>
                    </View>
                    <Text style={styles.pendingUpgradeBalance}>
                      Balance: {formatCurrency(Number(pendingPlanChangeRequest.balance_amount) || 0)}
                    </Text>
                  </View>
                  <Text style={styles.pendingUpgradeDesc}>
                    Requested upgrade to{' '}
                    <Text style={{ color: colors.gold, fontWeight: '700' }}>
                      {pendingPlanChangeRequest.requested_plan?.name || 'New Plan'}
                    </Text>
                    {pendingPlanChangeRequest.notes ? ` · "${pendingPlanChangeRequest.notes}"` : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setSelectedPlanChangeRequest(pendingPlanChangeRequest);
                      setShowPlanChangeModal(true);
                    }}
                    style={styles.reviewUpgradeBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reviewUpgradeBtnText}>
                      {['OWNER', 'ADMIN'].includes(user?.role || '')
                        ? 'Review & Collect Payment'
                        : 'View Request Details'}
                    </Text>
                    <ArrowRight size={13} color={colors.background} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.membershipDetails}>
                <View style={styles.membershipTitleRow}>
                  <Text style={styles.planNameTitle}>
                    {activeMembership.membership_plans?.name || 'Standard Membership'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setSelectedPlanChangeRequest(pendingPlanChangeRequest || null);
                      setShowPlanChangeModal(true);
                    }}
                    style={styles.upgradePlanLink}
                    activeOpacity={0.7}
                  >
                    <Sparkles size={12} color={colors.gold} />
                    <Text style={styles.upgradePlanLinkText}>
                      {pendingPlanChangeRequest ? 'Upgrade Details' : 'Upgrade Plan'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Calendar size={14} color={colors.gold} />
                  <Text style={styles.detailLabel}>Validity:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(activeMembership.start_date)} to{' '}
                    {formatDate(activeMembership.expiry_date)}
                  </Text>
                </View>

                {activeMembership.visit_day_limit != null && (
                  <View style={styles.detailRow}>
                    <UserCheck size={14} color={colors.gold} />
                    <Text style={styles.detailLabel}>Usable Visits:</Text>
                    <Text style={styles.detailValue}>
                      {activeMembership.visit_days_used || 0} /{' '}
                      {activeMembership.visit_day_limit} days used
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeText}>No active membership plan.</Text>
              <FVEButton
                title={canCollectPayment ? "Collect Payment & Assign Plan" : "Payment Completed"}
                disabled={!canCollectPayment}
                onPress={() => setShowPaymentModal(true)}
                variant={canCollectPayment ? "gold" : "outline"}
                size="sm"
                style={{ marginTop: 10, opacity: canCollectPayment ? 1 : 0.6 }}
              />
            </View>
          )}
        </View>

        {/* Personal Training Add-On Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Dumbbell size={15} color="#C084FC" />
              <Text style={styles.cardHeaderTitle}>PERSONAL TRAINING (ADD-ON)</Text>
            </View>
            {personalTraining ? (
              <FVEBadge
                label={personalTraining.status.replace('_', ' ')}
                color={
                  personalTraining.status === 'ACTIVE'
                    ? colors.success
                    : personalTraining.status === 'PENDING_PAYMENT'
                    ? colors.warning
                    : personalTraining.status === 'COMPLETED'
                    ? colors.info
                    : colors.gold
                }
                bgColor={
                  personalTraining.status === 'ACTIVE'
                    ? colors.successMuted
                    : personalTraining.status === 'PENDING_PAYMENT'
                    ? colors.warningMuted
                    : personalTraining.status === 'COMPLETED'
                    ? colors.infoMuted
                    : colors.goldMuted
                }
                borderColor={
                  personalTraining.status === 'ACTIVE'
                    ? colors.successBorder
                    : personalTraining.status === 'PENDING_PAYMENT'
                    ? colors.warningBorder
                    : personalTraining.status === 'COMPLETED'
                    ? colors.infoBorder
                    : colors.goldBorder
                }
              />
            ) : null}
          </View>

          {personalTraining ? (
            <View style={styles.ptCardContent}>
              <View style={styles.ptHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ptPlanTitle}>{personalTraining.package_name}</Text>
                  <Text style={styles.ptTrainerSubtitle}>
                    Trainer: <Text style={{ color: '#D8B4FE', fontWeight: '700' }}>{personalTraining.trainer?.full_name || 'Not yet assigned'}</Text>
                  </Text>
                </View>
                <Text style={styles.ptPriceTag}>
                  {personalTraining.price ? formatCurrency(personalTraining.price) : 'Custom'}
                </Text>
              </View>

              {/* Progress gauge */}
              {personalTraining.status !== 'REQUESTED' && (
                <View style={styles.ptProgressContainer}>
                  <View style={styles.ptProgressHeader}>
                    <Text style={styles.ptProgressLabel}>Sessions Progress</Text>
                    <Text style={styles.ptProgressVal}>
                      {personalTraining.sessions_completed || 0} / {personalTraining.total_sessions} ({Math.round(((personalTraining.sessions_completed || 0) / (personalTraining.total_sessions || 1)) * 100)}%)
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, Math.round(((personalTraining.sessions_completed || 0) / (personalTraining.total_sessions || 1)) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Status Specific Actions */}
              {personalTraining.status === 'REQUESTED' && (
                <View style={styles.ptStatusBox}>
                  <Text style={styles.ptStatusPrompt}>
                    Request submitted. Assign a trainer and confirm pricing to proceed.
                  </Text>
                  {['OWNER', 'ADMIN'].includes(user?.role || '') && (
                    <FVEButton
                      title="Assign Trainer & Pricing"
                      onPress={() => setShowPTAssignModal(true)}
                      variant="gold"
                      size="sm"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </View>
              )}

              {personalTraining.status === 'PENDING_PAYMENT' && (
                <View style={[styles.ptStatusBox, { borderColor: 'rgba(239, 161, 0, 0.3)', backgroundColor: 'rgba(239, 161, 0, 0.06)' }]}>
                  <Text style={styles.ptStatusPrompt}>
                    Trainer assigned. Collect add-on payment to activate sessions.
                  </Text>
                  <FVEButton
                    title={`Collect Payment (${personalTraining.price ? formatCurrency(personalTraining.price) : 'Add-on'})`}
                    onPress={() => setShowPTPayModal(true)}
                    variant="gold"
                    size="sm"
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}

              {personalTraining.status === 'ACTIVE' && (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.ptSessionsTitle}>SCHEDULED & RECENT SESSIONS</Text>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        setActivePTSession(null);
                        setPtSessionModalMode('schedule');
                        setShowPTSessionModal(true);
                      }}
                      style={styles.scheduleSessionBtn}
                    >
                      <Calendar size={12} color={colors.gold} />
                      <Text style={styles.scheduleSessionBtnText}>+ Schedule</Text>
                    </TouchableOpacity>
                  </View>

                  {(!ptSessions || ptSessions.length === 0) ? (
                    <Text style={styles.emptyText}>No sessions scheduled yet. Tap "+ Schedule" above.</Text>
                  ) : (
                    ptSessions.map(s => (
                      <View key={s.id} style={styles.sessionItem}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.sessionDateText}>{formatDate(s.session_date)} · {s.start_time}</Text>
                            <FVEBadge
                              label={s.status}
                              color={s.status === 'COMPLETED' ? colors.success : colors.gold}
                              bgColor={s.status === 'COMPLETED' ? colors.successMuted : colors.goldMuted}
                              borderColor={s.status === 'COMPLETED' ? colors.successBorder : colors.goldBorder}
                            />
                          </View>
                          {s.workout_notes ? (
                            <Text style={styles.sessionNotesText} numberOfLines={2}>
                              {s.workout_notes}
                            </Text>
                          ) : null}
                          {s.feedback ? (
                            <Text style={styles.sessionFeedbackText} numberOfLines={1}>
                              Feedback: {s.feedback}
                            </Text>
                          ) : null}
                        </View>
                        {s.status === 'SCHEDULED' && (
                          <TouchableOpacity
                            onPress={() => {
                              haptics.selection();
                              setActivePTSession(s);
                              setPtSessionModalMode('complete');
                              setShowPTSessionModal(true);
                            }}
                            style={styles.completeSessionBtn}
                          >
                            <CheckCircle2 size={13} color={colors.success} />
                            <Text style={styles.completeSessionBtnText}>Complete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {personalTraining.status === 'COMPLETED' && (
                <View style={[styles.ptStatusBox, { borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.06)' }]}>
                  <Text style={[styles.ptStatusPrompt, { color: colors.success }]}>
                    All {personalTraining.total_sessions} sessions completed successfully!
                  </Text>
                  <FVEButton
                    title="+ Request New PT Package"
                    onPress={() => setShowPTRequestModal(true)}
                    variant="outline"
                    size="sm"
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}

              {/* Custom Diet Plan Card (PT Exclusive) */}
              <View style={styles.ptDietCard}>
                <View style={styles.ptDietCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Apple size={16} color={colors.gold} />
                    <View>
                      <Text style={styles.ptDietCardTitle}>CUSTOM DIET PLAN</Text>
                      <Text style={styles.ptDietCardSub}>WhatsApp Daily Nutrition</Text>
                    </View>
                  </View>
                  {memberDietPlan ? (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        setShowDietModal(true);
                      }}
                      style={styles.ptDietEditBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ptDietEditBtnText}>Edit</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        setShowDietModal(true);
                      }}
                      style={styles.ptDietCreateBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.ptDietCreateBtnText}>+ Create Plan</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {memberDietPlan ? (() => {
                  const isWeekly = memberDietPlan.plan_type === 'WEEKLY' || Boolean(memberDietPlan.weekly_schedule && Object.keys(memberDietPlan.weekly_schedule).length > 0);
                  const today = getTodayDayOfWeek();
                  const activeDay = selectedDietDayPreview || today;
                  const currentMeals = isWeekly && memberDietPlan.weekly_schedule?.[activeDay]
                    ? memberDietPlan.weekly_schedule[activeDay]!
                    : (memberDietPlan.meals || []);

                  return (
                    <View style={styles.ptDietBody}>
                      <Text style={styles.ptDietPlanTitle}>{memberDietPlan.title}</Text>
                      {memberDietPlan.goal && (
                        <Text style={styles.ptDietPlanGoal}>🎯 {memberDietPlan.goal}</Text>
                      )}

                      {/* Validity & Plan Type */}
                      <View style={styles.dietValidityRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} color={colors.blue} />
                          <Text style={styles.dietValidityText}>
                            {memberDietPlan.start_date && memberDietPlan.end_date
                              ? `${formatDate(memberDietPlan.start_date)} – ${formatDate(memberDietPlan.end_date)}`
                              : '1-Month Ongoing'}
                          </Text>
                        </View>
                        <FVEBadge
                          label={isWeekly ? '7-DAY ROTATION' : 'DAILY PLAN'}
                          color={isWeekly ? colors.gold : colors.textMuted}
                          bgColor={isWeekly ? 'rgba(239, 161, 0, 0.12)' : 'rgba(255, 255, 255, 0.05)'}
                          size="sm"
                        />
                      </View>

                      <View style={styles.ptDietMacrosRow}>
                        <View style={styles.ptDietMacroCol}>
                          <Text style={styles.ptDietMacroLabel}>Calories</Text>
                          <Text style={[styles.ptDietMacroVal, { color: colors.gold }]}>
                            {memberDietPlan.daily_calories ? `${memberDietPlan.daily_calories}` : '—'}
                          </Text>
                        </View>
                        <View style={styles.ptDietMacroCol}>
                          <Text style={styles.ptDietMacroLabel}>Protein</Text>
                          <Text style={styles.ptDietMacroVal}>
                            {memberDietPlan.protein_grams ? `${memberDietPlan.protein_grams}g` : '—'}
                          </Text>
                        </View>
                        <View style={styles.ptDietMacroCol}>
                          <Text style={styles.ptDietMacroLabel}>Carbs/Fats</Text>
                          <Text style={[styles.ptDietMacroVal, { fontSize: 11 }]}>
                            {memberDietPlan.carbs_grams || 0}g / {memberDietPlan.fats_grams || 0}g
                          </Text>
                        </View>
                        <View style={styles.ptDietMacroCol}>
                          <Text style={styles.ptDietMacroLabel}>Water</Text>
                          <Text style={[styles.ptDietMacroVal, { color: colors.blue }]}>
                            {memberDietPlan.water_liters ? `${memberDietPlan.water_liters}L` : '—'}
                          </Text>
                        </View>
                      </View>

                      {/* If weekly: 7-day selector tabs */}
                      {isWeekly && (
                        <View style={{ marginTop: 2, marginBottom: 4 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                            {DAYS_OF_WEEK.map(day => {
                              const isAct = activeDay === day;
                              const isTod = day === today;
                              const count = (memberDietPlan.weekly_schedule?.[day] || []).length;
                              return (
                                <TouchableOpacity
                                  key={day}
                                  onPress={() => {
                                    haptics.selection();
                                    setSelectedDietDayPreview(day);
                                  }}
                                  style={[styles.dietDayChip, isAct && styles.dietDayChipActive]}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.dietDayChipText, isAct && styles.dietDayChipTextActive]}>
                                    {day.slice(0, 3)} {count > 0 ? `(${count})` : ''} {isTod ? '•' : ''}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      {/* Meals box */}
                      <View style={styles.ptDietMealsBox}>
                        <Text style={styles.ptDietMealsTitle}>
                          {isWeekly ? `${activeDay.toUpperCase()} MEALS (${currentMeals.length}):` : `SCHEDULED MEALS (${currentMeals.length}):`}
                        </Text>
                        {currentMeals.length === 0 ? (
                          <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 2 }}>
                            No meals listed for {activeDay}.
                          </Text>
                        ) : (
                          currentMeals.slice(0, 3).map((m, idx) => (
                            <Text key={idx} style={styles.ptDietMealItem} numberOfLines={1}>
                              • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{m.name}{m.time ? ` (${m.time})` : ''}</Text>: {m.items}
                            </Text>
                          ))
                        )}
                        {currentMeals.length > 3 && (
                          <Text style={styles.ptDietMealsMore}>+{currentMeals.length - 3} more meals</Text>
                        )}
                      </View>

                      {/* WhatsApp Action Buttons */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleSendWhatsAppDiet(isWeekly ? activeDay : undefined)}
                          style={[styles.ptDietWhatsAppBtn, { flex: 1 }]}
                          activeOpacity={0.8}
                        >
                          <MessageCircle size={15} color="#000" />
                          <Text style={styles.ptDietWhatsAppBtnText}>
                            Send {isWeekly ? `${activeDay.slice(0, 3)}'s Diet` : 'Diet'} via WhatsApp
                          </Text>
                        </TouchableOpacity>

                        {isWeekly && (
                          <TouchableOpacity
                            onPress={() => {
                              haptics.light();
                              setShowDietShareModal(true);
                            }}
                            style={styles.dietMoreDaysBtn}
                            activeOpacity={0.7}
                          >
                            <ChevronDown size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })() : (
                  <Text style={styles.ptDietEmptyText}>
                    No custom diet plan created yet for this PT member. Tap "+ Create Plan" to set calories, macros, and daily meals for WhatsApp sharing.
                  </Text>
                )}
              </View>

              {/* Cancel PT Option */}
              {['OWNER', 'ADMIN'].includes(user?.role || '') && (
                <TouchableOpacity
                  onPress={handleCancelPT}
                  style={{
                    marginTop: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={13} color={colors.error} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.error, fontFamily: typography.fonts.rajdhani }}>
                    Cancel PT & Delete Payment
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeText}>
                No Personal Training package currently active.
              </Text>
              <Text style={[styles.emptyNoticeText, { fontSize: 11, color: colors.textMuted, marginTop: 2, marginBottom: 8 }]}>
                Add 1-on-1 coaching at any time linked to active membership.
              </Text>

              {/* Locked Diet Notice */}
              <View style={styles.lockedDietBanner}>
                <Lock size={14} color={colors.gold} />
                <Text style={styles.lockedDietText}>
                  Custom Diet Plans & Daily WhatsApp Delivery are exclusive to Personal Training members.
                </Text>
              </View>
              <FVEButton
                title="+ Request Personal Training"
                onPress={() => {
                  if (!activeMembership || activeMembership.status !== 'ACTIVE') {
                    Alert.alert(
                      'Membership Status',
                      'Personal Training requires an active gym membership. Would you like to proceed with requesting PT now?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Proceed', onPress: () => setShowPTRequestModal(true) },
                      ]
                    );
                  } else {
                    setShowPTRequestModal(true);
                  }
                }}
                variant="gold"
                size="sm"
              />
            </View>
          )}
        </View>

        {/* Payment History */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>PAYMENT HISTORY</Text>
          {(!payments || payments.length === 0) ? (
            <Text style={styles.emptyText}>No payments recorded yet.</Text>
          ) : (
            payments.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => navigation.navigate('PaymentReceipt', { payment: p })}
                style={styles.paymentRow}
              >
                <View>
                  <Text style={styles.payReceiptNo}>
                    #{p.receipt_number || 'N/A'} · {p.payment_method}
                  </Text>
                  <Text style={styles.payDate}>
                    {formatDate(p.payment_date || p.created_at)}
                  </Text>
                </View>
                <Text style={styles.payAmount}>{formatCurrency(p.amount)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Attendance History */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardHeaderTitle}>RECENT ATTENDANCE</Text>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setShowCalendarModal(true);
              }}
              style={styles.newPayLink}
            >
              <Calendar size={13} color={colors.gold} />
              <Text style={styles.newPayLinkText}>View Calendar</Text>
            </TouchableOpacity>
          </View>
          {(!attendanceLogs || attendanceLogs.length === 0) ? (
            <Text style={styles.emptyText}>No check-ins recorded yet.</Text>
          ) : (
            attendanceLogs.map(a => (
              <View key={a.id} style={styles.attendanceRow}>
                <View style={styles.attLeft}>
                  <Calendar size={13} color={colors.gold} />
                  <Text style={styles.attDate}>{formatDate(a.date)}</Text>
                </View>
                <View style={styles.attRight}>
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={styles.attTime}>{a.check_in_time || 'Recorded'}</Text>
                  <View style={styles.attMethodBadge}>
                    <Text style={styles.attMethodText}>{a.check_in_method || 'QR'}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Workout Plans */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardHeaderTitle}>ASSIGNED WORKOUT PLANS</Text>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setShowWorkoutModal(true);
              }}
              style={styles.newPayLink}
            >
              <Dumbbell size={13} color={colors.gold} />
              <Text style={styles.newPayLinkText}>+ Assign Plan</Text>
            </TouchableOpacity>
          </View>
          {(!workouts || workouts.length === 0) ? (
            <Text style={styles.emptyText}>No workout plans assigned yet.</Text>
          ) : (
            workouts.map(w => (
              <View key={w.id} style={styles.workoutRow}>
                <View style={styles.workoutLeft}>
                  <Dumbbell size={15} color={colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workoutTitle}>{w.title}</Text>
                    {w.description ? (
                      <Text style={styles.workoutDesc}>{w.description}</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.workoutDate}>{formatDate(w.created_at)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Delete Member Button */}
        <FVEButton
          title="DELETE MEMBER"
          onPress={handleDelete}
          variant="danger"
          size="sm"
          style={styles.deleteButton}
        />
      </ScrollView>

      {/* Edit Member Modal */}
      <MemberFormModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ['mobile-members'] });
        }}
        member={member}
      />

      {/* Payment Form Modal */}
      <PaymentFormModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSaved={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ['member-detail', memberId] });
          qc.invalidateQueries({ queryKey: ['member-memberships', memberId] });
          qc.invalidateQueries({ queryKey: ['member-payments', memberId] });
          qc.invalidateQueries({ queryKey: ['mobile-members'] });
          qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
          qc.invalidateQueries({ queryKey: ['expiring-memberships'] });
        }}
        preselectedMemberId={memberId}
      />

      {/* Plan Upgrade / Change Modal */}
      {activeMembership && member && (
        <PlanChangeModal
          visible={showPlanChangeModal}
          onClose={() => {
            setShowPlanChangeModal(false);
            setSelectedPlanChangeRequest(null);
          }}
          member={member}
          activeMembership={activeMembership}
          existingRequest={selectedPlanChangeRequest}
          onSuccess={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ['member-detail', memberId] });
            qc.invalidateQueries({ queryKey: ['member-memberships', memberId] });
            qc.invalidateQueries({ queryKey: ['member-payments', memberId] });
            qc.invalidateQueries({ queryKey: ['member-plan-change-requests', memberId] });
            qc.invalidateQueries({ queryKey: ['plan-change-requests'] });
            qc.invalidateQueries({ queryKey: ['mobile-membership-plans'] });
            qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
          }}
        />
      )}

      {/* Attendance Calendar Modal */}
      {member && (
        <AttendanceCalendarModal
          visible={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          member={member}
          membershipStartDate={activeMembership?.start_date}
          membershipExpiryDate={activeMembership?.expiry_date}
        />
      )}

      {/* Workout Plan Modal */}
      {member && (
        <WorkoutPlanModal
          visible={showWorkoutModal}
          onClose={() => setShowWorkoutModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['member-workouts', memberId] });
          }}
          memberId={member.id}
          memberName={member.full_name}
        />
      )}

      {/* Personal Training Modals */}
      {member && (
        <PTRequestModal
          visible={showPTRequestModal}
          onClose={() => setShowPTRequestModal(false)}
          onSaved={() => {
            refetchPT();
            qc.invalidateQueries({ queryKey: ['member-pt', memberId] });
          }}
          memberId={member.id}
          memberName={member.full_name}
          membershipId={activeMembership?.id}
          planName={activeMembership?.membership_plans?.name}
        />
      )}

      {personalTraining && (
        <PTAssignmentModal
          visible={showPTAssignModal}
          onClose={() => setShowPTAssignModal(false)}
          onSaved={() => {
            refetchPT();
            qc.invalidateQueries({ queryKey: ['member-pt', memberId] });
          }}
          pt={personalTraining}
        />
      )}

      {personalTraining && (
        <PTPaymentModal
          visible={showPTPayModal}
          onClose={() => setShowPTPayModal(false)}
          onSaved={() => {
            refetchPT();
            qc.invalidateQueries({ queryKey: ['member-pt', memberId] });
            qc.invalidateQueries({ queryKey: ['member-payments', memberId] });
          }}
          pt={personalTraining}
        />
      )}

      {personalTraining && (
        <PTSessionModal
          visible={showPTSessionModal}
          onClose={() => {
            setShowPTSessionModal(false);
            setActivePTSession(null);
          }}
          onSaved={() => {
            refetchPT();
            refetchSessions();
            qc.invalidateQueries({ queryKey: ['member-pt', memberId] });
            qc.invalidateQueries({ queryKey: ['member-pt-sessions', personalTraining.id] });
          }}
          pt={personalTraining}
          session={activePTSession}
          mode={ptSessionModalMode}
        />
      )}

      {/* Diet Plan Modal */}
      {showDietModal && member && (
        <DietPlanModal
          visible={showDietModal}
          onClose={() => setShowDietModal(false)}
          onSuccess={() => {
            refetchDietPlan();
            qc.invalidateQueries({ queryKey: ['mobile-diet-plans'] });
          }}
          initialMemberId={member.id}
          initialPTId={personalTraining?.id}
          existingDiet={memberDietPlan}
        />
      )}

      {/* Diet Plan Share Day Picker Modal */}
      {showDietShareModal && memberDietPlan && (
        <FVEModal
          visible={showDietShareModal}
          onClose={() => setShowDietShareModal(false)}
          title="SHARE DIET VIA WHATSAPP"
          subtitle={`Member: ${member?.full_name || 'Member'}`}
        >
          <View style={{ gap: 8, paddingBottom: 16 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: typography.fonts.inter, marginBottom: 4 }}>
              Choose which day of the weekly rotation to send:
            </Text>
            {DAYS_OF_WEEK.map(day => {
              const isToday = day === getTodayDayOfWeek();
              const mealsCount = (memberDietPlan.weekly_schedule?.[day] || []).length;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => {
                    handleSendWhatsAppDiet(day);
                    setShowDietShareModal(false);
                  }}
                  style={[
                    styles.shareDayItem,
                    isToday && { borderColor: colors.gold, backgroundColor: 'rgba(239, 161, 0, 0.08)' },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.shareDayName, isToday && { color: colors.gold }]}>
                      {day} {isToday ? '(Today)' : ''}
                    </Text>
                    <Text style={styles.shareDayCount}>· {mealsCount} meals</Text>
                  </View>
                  <MessageCircle size={15} color="#25D366" />
                </TouchableOpacity>
              );
            })}

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />

            <TouchableOpacity
              onPress={() => {
                handleSendWhatsAppFullWeekDiet();
                setShowDietShareModal(false);
              }}
              style={styles.shareFullWeekBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.shareFullWeekText}>📋 Send Full 7-Day Meal Schedule</Text>
            </TouchableOpacity>
          </View>
        </FVEModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  profileCard: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.gold,
    marginRight: 14,
  },
  fallbackAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#191E24',
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  fallbackText: {
    color: colors.gold,
    fontSize: typography.sizes.xxl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  idBadge: {
    backgroundColor: colors.goldMuted,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  idBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  statusBadge: {
    marginTop: 2,
  },
  birthdayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  birthdayBadgeText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  joinedText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#161A20',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 8,
    paddingVertical: 8,
  },
  whatsappBtn: {
    borderColor: 'rgba(37, 211, 102, 0.4)',
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
  },
  contactBtnText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.8,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginTop: 2,
  },
  qrCard: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 12,
    marginVertical: 14,
  },
  qrCodeText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.orbitron,
    letterSpacing: 1,
  },
  qrSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  newPayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.goldMuted,
  },
  disabledPayLink: {
    backgroundColor: '#1E232B',
    opacity: 0.6,
  },
  newPayLinkText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  disabledPayLinkText: {
    color: colors.textMuted,
  },
  collectPayBtn: {
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  payCompletedBtn: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12151B',
    opacity: 0.6,
  },
  holdToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  pauseToggleBtn: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  reactivateToggleBtn: {
    backgroundColor: colors.successMuted,
    borderColor: colors.successBorder,
  },
  holdToggleText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  membershipDetails: {
    backgroundColor: '#14181E',
    borderRadius: 10,
    padding: 12,
  },
  planNameTitle: {
    color: colors.gold,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    fontWeight: '600',
  },
  emptyNotice: {
    padding: 14,
    alignItems: 'center',
  },
  emptyNoticeText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  payReceiptNo: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
  },
  payDate: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  payAmount: {
    color: colors.gold,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  attLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attDate: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.inter,
  },
  attRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attTime: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  attMethodBadge: {
    backgroundColor: colors.goldMuted,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  attMethodText: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  deleteButton: {
    marginTop: 10,
    alignSelf: 'center',
    width: '60%',
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  workoutLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  workoutTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  workoutDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  workoutDate: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
  },
  ptCardContent: {
    marginTop: 4,
  },
  ptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ptPlanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  ptTrainerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fonts.inter,
  },
  ptPriceTag: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    fontFamily: typography.fonts.rajdhani,
  },
  ptProgressContainer: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  ptProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ptProgressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
  },
  ptProgressVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  ptStatusBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    marginVertical: 8,
  },
  ptStatusPrompt: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    fontFamily: typography.fonts.inter,
  },
  ptSessionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    fontFamily: typography.fonts.rajdhani,
  },
  scheduleSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  scheduleSessionBtnText: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '700',
    fontFamily: typography.fonts.rajdhani,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 6,
    gap: 10,
  },
  sessionDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  sessionNotesText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fonts.inter,
  },
  sessionFeedbackText: {
    fontSize: 10,
    color: '#86EFAC',
    marginTop: 2,
    fontFamily: typography.fonts.inter,
  },
  completeSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  completeSessionBtnText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '700',
    fontFamily: typography.fonts.rajdhani,
  },
  pendingUpgradeBanner: {
    backgroundColor: 'rgba(239, 161, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  pendingUpgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingUpgradeTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.warning,
    letterSpacing: 0.6,
  },
  pendingUpgradeBalance: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 12,
    color: colors.gold,
  },
  pendingUpgradeDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  reviewUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  reviewUpgradeBtnText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    color: colors.background,
  },
  membershipTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  upgradePlanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  upgradePlanLinkText: {
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    color: colors.gold,
    letterSpacing: 0.3,
  },
  ptDietCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    gap: 8,
  },
  ptDietCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ptDietCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
  ptDietCardSub: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
  },
  ptDietEditBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  ptDietEditBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
  },
  ptDietCreateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  ptDietCreateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    fontFamily: typography.fonts.rajdhani,
  },
  ptDietBody: {
    gap: 8,
  },
  ptDietPlanTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  ptDietPlanGoal: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: typography.fonts.inter,
  },
  ptDietMacrosRow: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  ptDietMacroCol: {
    flex: 1,
    alignItems: 'center',
  },
  ptDietMacroLabel: {
    fontSize: 8,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    marginBottom: 2,
  },
  ptDietMacroVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  ptDietMealsBox: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  ptDietMealsTitle: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
  },
  ptDietWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  ptDietWhatsAppBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
  ptDietEmptyText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  lockedDietBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    marginBottom: 8,
  },
  lockedDietText: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    lineHeight: 15,
  },
  dietValidityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: 4,
  },
  dietValidityText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: typography.fonts.rajdhani,
  },
  dietDayChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  dietDayChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  dietDayChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: typography.fonts.rajdhani,
  },
  dietDayChipTextActive: {
    color: '#000',
  },
  ptDietMealItem: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
    marginVertical: 1,
  },
  ptDietMealsMore: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    textAlign: 'center',
    marginTop: 2,
  },
  dietMoreDaysBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareDayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareDayName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  shareDayCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
  },
  shareFullWeekBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 102, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareFullWeekText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: typography.fonts.rajdhani,
  },
});

