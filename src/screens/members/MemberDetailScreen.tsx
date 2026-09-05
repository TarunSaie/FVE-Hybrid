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
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEButton } from '@/components/common/FVEButton';
import { MemberFormModal } from '@/components/features/MemberFormModal';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { AttendanceCalendarModal } from '@/components/features/AttendanceCalendarModal';
import { WorkoutPlanModal } from '@/components/features/WorkoutPlanModal';
import { Member, Membership, Payment, Attendance, WorkoutPlan } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDate, calculateAge, getLocalDateStr } from '@/utils/date';
import { formatCurrency, openWhatsAppLink, buildExpiredAlertMessage } from '@/utils/format';
import { haptics } from '@/utils/haptics';
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
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

  const activeMembership = memberships?.[0];
  const initial = member?.full_name?.charAt(0)?.toUpperCase() || '?';

  const onRefresh = async () => {
    haptics.light();
    setRefreshing(true);
    await Promise.all([
      refetch(),
      qc.invalidateQueries({ queryKey: ['member-memberships', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-payments', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-attendance', memberId] }),
      qc.invalidateQueries({ queryKey: ['member-workouts', memberId] }),
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

  const handleDelete = () => {
    haptics.heavy();
    Alert.alert(
      'Delete Member',
      `Are you sure you want to remove ${member?.full_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', memberId);
              if (error) throw error;
              haptics.success();
              qc.invalidateQueries({ queryKey: ['mobile-members'] });
              navigation.goBack();
            } catch (err: unknown) {
              haptics.error();
              Alert.alert('Error', (err as Error).message || 'Failed to delete');
            }
          },
        },
      ]
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
    activeMembership?.status === 'EXPIRED' ||
    (!!activeMembership?.expiry_date && activeMembership.expiry_date < todayStr);

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
                const receiptText = `*FitVerse Elite Official Receipt*\nReceipt No: #${receiptData.receiptNumber}\nMember: ${receiptData.memberName}${receiptData.memberId ? ` (${receiptData.memberId})` : ''}\nPlan: ${receiptData.planName}\nAmount Paid: ${formatCurrency(receiptData.amount)}\nPayment Method: ${receiptData.paymentMethod}\nDate: ${receiptData.paymentDate}\n\n*DISCIPLINE • STRENGTH • TRANSFORMATION*\nFitVerse Elite Gym`;
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

          {/* Quick Contact Buttons */}
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
                onPress={() => setShowPaymentModal(true)}
                style={styles.newPayLink}
              >
                <CreditCard size={14} color={colors.gold} />
                <Text style={styles.newPayLinkText}>+ Renew</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeMembership ? (
            <View style={styles.membershipDetails}>
              <Text style={styles.planNameTitle}>
                {activeMembership.membership_plans?.name || 'Standard Membership'}
              </Text>

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
          ) : (
            <View style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeText}>No active membership plan.</Text>
              <FVEButton
                title="Assign Plan & Pay"
                onPress={() => setShowPaymentModal(true)}
                variant="gold"
                size="sm"
                style={{ marginTop: 10 }}
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
          qc.invalidateQueries({ queryKey: ['member-memberships', memberId] });
          qc.invalidateQueries({ queryKey: ['member-payments', memberId] });
        }}
        preselectedMemberId={memberId}
      />

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
  newPayLinkText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
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
});
