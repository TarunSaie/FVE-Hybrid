import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { Share2, ArrowLeft, CheckCircle2, Printer, Dumbbell, UserCheck } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEButton } from '@/components/common/FVEButton';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { haptics } from '@/utils/haptics';
import { Payment, PersonalTraining } from '@/types';
import { supabase } from '@/api/supabase';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate, calculateMembershipDurationDays } from '@/utils/date';
import { printPdfReceipt, buildReceiptDataFromPayment, shareReceiptPdfToWhatsApp } from '@/utils/receiptPdf';
import { RootStackParamList } from '@/navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'PaymentReceipt'>;

export function PaymentReceiptScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const payment = route.params?.payment;
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getReceiptStyles(colors, isDark), [colors, isDark]);

  if (!payment) {
    return (
      <View style={styles.container}>
        <FVEHeader title="RECEIPT" showBack onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Payment receipt data not found.</Text>
        </View>
      </View>
    );
  }

  // Fetch fresh full payment details if navigation param lacked nested fields
  const { data: fetchedPayment } = useQuery<Payment | null>({
    queryKey: ['payment-receipt-detail', payment.id],
    queryFn: async () => {
      if (!payment.id) return null;
      const { data, error } = await supabase
        .from('payments')
        .select('*, members(*), memberships(*, membership_plans(*))')
        .eq('id', payment.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching full payment for receipt:', error);
        return null;
      }
      return data as Payment;
    },
    enabled: !!payment.id,
    refetchInterval: 5000,
  });

  const activePayment = fetchedPayment || payment;

  // Query linked personal training record if any
  const { data: ptRecord } = useQuery<PersonalTraining | null>({
    queryKey: ['payment-pt-addon', activePayment.id],
    queryFn: async () => {
      if (!activePayment.id) return null;

      // 1. Direct payment_id lookup
      const { data: pt1 } = await supabase
        .from('personal_training')
        .select('*, trainer:user_profiles!personal_training_trainer_id_fkey(*)')
        .eq('payment_id', activePayment.id)
        .maybeSingle();

      if (pt1) return pt1 as PersonalTraining;

      // 2. Try with trainer_id FK
      const { data: pt2 } = await supabase
        .from('personal_training')
        .select('*, trainer:user_profiles!trainer_id(*)')
        .eq('payment_id', activePayment.id)
        .maybeSingle();

      if (pt2) return pt2 as PersonalTraining;

      // 3. Fallback by member_id if notes indicate Personal Training
      if (activePayment.notes?.includes('Personal Training') && activePayment.member_id) {
        const { data: pt3 } = await supabase
          .from('personal_training')
          .select('*, trainer:user_profiles!personal_training_trainer_id_fkey(*)')
          .eq('member_id', activePayment.member_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pt3) return pt3 as PersonalTraining;
      }

      return null;
    },
    enabled: !!activePayment.id,
  });

  // Query member's active or linked membership if activePayment.memberships is not linked
  const { data: fallbackMembership } = useQuery({
    queryKey: ['receipt-fallback-membership', activePayment.member_id, activePayment.membership_id],
    queryFn: async () => {
      if (!activePayment.member_id) return null;
      if (activePayment.membership_id) {
        const { data } = await supabase
          .from('memberships')
          .select('*, membership_plans(*)')
          .eq('id', activePayment.membership_id)
          .maybeSingle();
        if (data) return data;
      }
      const { data } = await supabase
        .from('memberships')
        .select('*, membership_plans(*)')
        .eq('member_id', activePayment.member_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !activePayment.memberships && !!activePayment.member_id,
  });

  const effectiveMembership = activePayment.memberships || fallbackMembership;

  const isPT = Boolean(ptRecord || activePayment.notes?.includes('Personal Training'));
  const memberName = activePayment.members?.full_name || payment.members?.full_name || 'Member';
  const memberMobile = activePayment.members?.mobile || payment.members?.mobile;
  const memberId = activePayment.members?.member_id || payment.members?.member_id;
  const plan = effectiveMembership?.membership_plans || activePayment.memberships?.membership_plans;
  const displayPlanName = isPT
    ? (ptRecord?.package_name ? `Personal Training — ${ptRecord.package_name}` : 'Personal Training Add-On')
    : (plan?.name || 'Gym Subscription');

  const memberDbId = activePayment.member_id;
  const membershipStart = effectiveMembership?.start_date;
  const membershipExpiry = effectiveMembership?.expiry_date;
  const visitDayLimit = effectiveMembership?.visit_day_limit ?? null;

  // Query actual attendance records for this member within the membership period
  const { data: attendanceCount } = useQuery({
    queryKey: ['receipt-member-attendance', memberDbId, membershipStart, membershipExpiry],
    queryFn: async () => {
      if (!memberDbId) return 0;
      let q = supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberDbId);

      if (membershipStart) q = q.gte('date', membershipStart);
      if (membershipExpiry) q = q.lte('date', membershipExpiry);

      const { count, error } = await q;
      if (error) {
        console.error('Error fetching attendance count for receipt:', error);
        return null;
      }
      return count ?? 0;
    },
    enabled: !!memberDbId && visitDayLimit != null,
    refetchInterval: 5000,
  });

  const actualVisitsUsed = attendanceCount ?? effectiveMembership?.visit_days_used ?? 0;
  const remainingVisits = visitDayLimit != null ? Math.max(0, visitDayLimit - actualVisitsUsed) : null;

  // Query completed PT sessions if this is a personal training receipt
  const ptId = ptRecord?.id;
  const { data: completedPTSessionsCount } = useQuery({
    queryKey: ['receipt-pt-sessions-completed', ptId],
    queryFn: async () => {
      if (!ptId) return 0;
      const { count, error } = await supabase
        .from('pt_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('personal_training_id', ptId)
        .eq('status', 'COMPLETED');

      if (error) {
        console.error('Error fetching PT sessions count for receipt:', error);
        return null;
      }
      return count ?? 0;
    },
    enabled: !!ptId && isPT,
    refetchInterval: 5000,
  });

  const actualPTSessionsCompleted = completedPTSessionsCount ?? ptRecord?.sessions_completed ?? 0;
  const totalPTSessions = ptRecord?.total_sessions ?? null;
  const remainingPTSessions = totalPTSessions != null ? Math.max(0, totalPTSessions - actualPTSessionsCompleted) : null;

  const receiptNo = activePayment.receipt_number || 'FVE-N/A';
  const dateStr = formatDate(activePayment.payment_date || activePayment.created_at);
  const rawStart = isPT && ptRecord?.start_date
    ? ptRecord.start_date
    : effectiveMembership?.start_date;
  const rawEnd = isPT && ptRecord?.expiry_date
    ? ptRecord.expiry_date
    : effectiveMembership?.expiry_date;
  const startDate = rawStart ? formatDate(rawStart) : null;
  const endDate = rawEnd ? formatDate(rawEnd) : null;
  const durationDays =
    plan?.duration_days ||
    (rawStart && rawEnd ? calculateMembershipDurationDays(rawStart, rawEnd) : null);

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const receiptAmount = `Rs. ${Number(activePayment.amount || 0).toLocaleString('en-IN')}/-`;
  const whatsAppReceiptText =
    `FitVerse Elite Receipt\n` +
    `Receipt No: #${receiptNo}\n` +
    `Member: ${memberName}\n` +
    `Plan: ${displayPlanName}\n` +
    (startDate && endDate ? `Validity: ${startDate} TO ${endDate}\n` : '') +
    `Amount Paid: ${receiptAmount}\n\n` +
    `THANKS FOR TRAINING WITH US\n` +
    `DISCIPLINE • STRENGTH • TRANSFORMATION\n\n` +
    `This is an automated receipt generated and sent by Chirvex.\n` +
    `Chirvex builds high-converting websites, SEO strategies, and lead generation solutions that help businesses grow.\n` +
    `www.chirvex.in`;

  const handleShareToWhatsApp = async () => {
    if (!memberMobile) {
      haptics.error();
      Alert.alert(
        'No Mobile Number',
        'This member does not have a registered mobile number. Please update their profile with a valid WhatsApp phone number.'
      );
      return;
    }

    haptics.medium();
    setPdfGenerating(true);
    try {
      const receiptData = buildReceiptDataFromPayment(activePayment, ptRecord, {
        actualVisitsUsed,
        remainingVisits,
        actualPTSessionsCompleted,
        remainingPTSessions,
      });
      await shareReceiptPdfToWhatsApp(receiptData, memberMobile, whatsAppReceiptText);
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Share on WhatsApp', (err as Error).message || 'Failed to open the member WhatsApp chat.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!activePayment) return;
    haptics.light();
    try {
      const receiptData = buildReceiptDataFromPayment(activePayment, ptRecord, {
        actualVisitsUsed,
        remainingVisits,
        actualPTSessionsCompleted,
        remainingPTSessions,
      });
      await printPdfReceipt(receiptData);
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to open print dialog');
    }
  };

  const memberQrCode =
    activePayment.members?.qr_code ||
    activePayment.members?.id ||
    activePayment.member_id ||
    activePayment.receipt_number;

  return (
    <View style={styles.container}>
      <FVEHeader
        title={isPT ? "PT RECEIPT" : "PAYMENT RECEIPT"}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              handleShareToWhatsApp();
            }}
            style={styles.shareHeaderBtn}
          >
            <Share2 size={16} color={colors.gold} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Receipt Voucher Card */}
        <View style={styles.receiptCard}>
          {/* Header */}
          <View style={styles.receiptHeader}>
            <Image
              source={require('@/../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>FITVERSE ELITE</Text>
            {isPT ? (
              <View style={styles.ptTag}>
                <Dumbbell size={12} color={colors.gold} />
                <Text style={styles.ptTagText}>PERSONAL TRAINING ADD-ON</Text>
              </View>
            ) : (
              <Text style={styles.receiptSubHeader}>MEMBERSHIP RECEIPT</Text>
            )}
            <Text style={styles.proofText}>
              {isPT ? 'PERSONAL TRAINING RECEIPT' : 'OFFICIAL PROOF OF PAYMENT'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Receipt Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>RECEIPT NO</Text>
              <Text style={styles.metaValue}>#{receiptNo}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'center' }]}>
              <Text style={styles.metaLabel}>DATE</Text>
              <Text style={styles.metaValue}>{dateStr}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>PAYMENT</Text>
              <Text style={styles.metaValue}>{(payment.payment_method || 'CASH').toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Details Table */}
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>MEMBER</Text>
              <Text style={styles.detailValue}>{memberName}</Text>
            </View>

            {memberId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>MEMBER ID</Text>
                <Text style={[styles.detailValue, { color: colors.gold, fontFamily: typography.fonts.rajdhani, fontWeight: '700' }]}>
                  {memberId}
                </Text>
              </View>
            )}

            {memberMobile && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>MOBILE</Text>
                <Text style={styles.detailValue}>{memberMobile}</Text>
              </View>
            )}

            {isPT ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PACKAGE / SERVICE</Text>
                  <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                    {displayPlanName}
                  </Text>
                </View>
                {ptRecord?.trainer?.full_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>ASSIGNED TRAINER</Text>
                    <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                      {ptRecord.trainer.full_name}
                    </Text>
                  </View>
                )}
                {totalPTSessions != null && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>TOTAL SESSIONS</Text>
                      <Text style={[styles.detailValue, { color: colors.gold }]}>
                        {totalPTSessions} Sessions ({actualPTSessionsCompleted} completed)
                      </Text>
                    </View>
                    <View style={{ marginTop: 2, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 15 }}>
                        Sessions: {totalPTSessions} sessions allotted throughout your entire subscription period.
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.gold, fontWeight: '600', marginTop: 2, lineHeight: 15 }}>
                        {actualPTSessionsCompleted}/{totalPTSessions} sessions completed.{' '}
                        {remainingPTSessions != null && remainingPTSessions > 1
                          ? `You can attend ${remainingPTSessions} more sessions during your plan.`
                          : remainingPTSessions === 1
                          ? `You can attend 1 more session during your plan.`
                          : `All allotted sessions have been completed.`}
                      </Text>
                    </View>
                  </>
                )}
                {startDate && endDate && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>PT VALIDITY PERIOD</Text>
                      <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                        {startDate} TO {endDate}
                      </Text>
                    </View>
                    {durationDays != null && durationDays > 0 && (
                      <View style={{ marginTop: -4, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          {durationDays} Days Personal Training Validity
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PLAN</Text>
                  <Text style={styles.detailValue}>{displayPlanName}</Text>
                </View>
                {startDate && endDate && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>VALIDITY</Text>
                      <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                        {startDate} TO {endDate}
                      </Text>
                    </View>
                    {durationDays != null && durationDays > 0 && (
                      <View style={{ marginTop: -4, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          {durationDays} Days Membership
                        </Text>
                      </View>
                    )}
                  </>
                )}
                {visitDayLimit != null && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>VISITS ALLOTTED</Text>
                      <Text style={[styles.detailValue, { color: colors.gold }]}>
                        {visitDayLimit} Visits ({actualVisitsUsed} used)
                      </Text>
                    </View>
                    <View style={{ marginTop: 2, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 15 }}>
                        Visits: {visitDayLimit} visits allotted throughout your entire subscription period.
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.gold, fontWeight: '600', marginTop: 2, lineHeight: 15 }}>
                        {actualVisitsUsed}/{visitDayLimit} visits used.{' '}
                        {remainingVisits != null && remainingVisits > 1
                          ? `${remainingVisits} visits remaining during your plan.`
                          : remainingVisits === 1
                          ? `1 visit remaining during your plan.`
                          : `All allotted visits have been used.`}
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}

            {payment.transaction_reference && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>TXN REFERENCE</Text>
                <Text style={styles.detailValue}>{payment.transaction_reference}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Receipt QR Code */}
          {memberQrCode && (
            <View style={styles.qrSection}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={memberQrCode}
                  size={110}
                  color={colors.gold}
                  backgroundColor="#0A0A0A"
                />
              </View>
              <Text style={styles.qrFooterText}>
                {isPT ? 'MEMBER ATTENDANCE & PT QR CODE' : 'MEMBER QR CODE'}
              </Text>
            </View>
          )}

          {/* Amount Paid Showcase */}
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>AMOUNT PAID</Text>
            <Text style={styles.amountValue}>
              {`Rs. ${Number(payment.amount || 0).toLocaleString('en-IN')}/-`}
            </Text>
          </View>

          {/* THANKS FOR TRAINING WITH US */}
          <View style={styles.thanksSection}>
            <Text style={styles.thanksTitle}>THANKS FOR TRAINING WITH US</Text>
            <Text style={styles.thanksSubtitle}>DISCIPLINE • STRENGTH • TRANSFORMATION</Text>
          </View>

          <View style={styles.divider} />

          {/* Footer Branding */}
          <View style={styles.footerBranding}>
            <Text style={styles.receiptFooter}>
              FITVERSE ELITE • {isPT ? 'PERSONAL TRAINING' : 'MEMBERSHIP'} RECEIPT
            </Text>
            <Text style={styles.chirvexTagline}>
              Built with <Text style={{ color: colors.gold, fontWeight: '700' }}>Chirvex</Text> © 2026
            </Text>
            <Text style={styles.chirvexLink}>https://chirvex.in/</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonGroup}>
          <FVEButton
            title="SHARE TO WHATSAPP"
            onPress={handleShareToWhatsApp}
            loading={pdfGenerating}
            variant="gold"
            size="lg"
            icon={<Share2 size={18} color="#050505" />}
            style={styles.actionButton}
          />

          <FVEButton
            title="PRINT / SAVE PDF DOCUMENT"
            onPress={handlePrintPdf}
            variant="ghost"
            size="md"
            icon={<Printer size={16} color={colors.gold} />}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>

    </View>
  );
}

const getReceiptStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    shareHeaderBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.goldMuted,
    },
    emptyContainer: {
      padding: 30,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: typography.sizes.base,
    },
    receiptCard: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.3)',
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 12,
      elevation: 6,
    },
    receiptHeader: {
      alignItems: 'center',
      paddingBottom: 16,
    },
    logo: {
      width: 60,
      height: 60,
      marginBottom: 8,
    },
    brandTitle: {
      color: colors.gold,
      fontSize: typography.sizes.lg,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '900',
      letterSpacing: 1.5,
    },
    brandTagline: {
      color: colors.textSecondary,
      fontSize: 9,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 2,
    },
    ptTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(217, 130, 0, 0.12)',
      borderColor: isDark ? 'rgba(239, 161, 0, 0.4)' : 'rgba(217, 130, 0, 0.35)',
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    ptTagText: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    successTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.successMuted,
      borderColor: colors.successBorder,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    successTagText: {
      color: colors.success,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.2)' : 'rgba(217, 130, 0, 0.2)',
      marginVertical: 14,
    },
    amountBox: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    amountLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1,
    },
    amountValue: {
      color: colors.gold,
      fontSize: 34,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginVertical: 4,
    },
    receiptNumber: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
    },
    detailsList: {
      gap: 10,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    detailLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    detailValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      fontWeight: '600',
      textAlign: 'right',
      maxWidth: '60%',
    },
    qrSection: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    qrContainer: {
      padding: 10,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.goldBorder,
      borderRadius: 10,
      marginBottom: 6,
    },
    qrFooterText: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
    },
    receiptFooter: {
      color: colors.textSubtle,
      fontSize: 9,
      fontFamily: typography.fonts.inter,
      textAlign: 'center',
      marginTop: 14,
    },
    actionButton: {
      marginTop: 16,
    },
    actionButtonGroup: {
      marginTop: 8,
      marginBottom: 20,
    },
    modalOptionList: {
      gap: 12,
      paddingVertical: 6,
    },
    modalOptionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 14,
      padding: 16,
      gap: 14,
    },
    modalOptionCardHighlight: {
      borderColor: isDark ? 'rgba(239, 161, 0, 0.45)' : 'rgba(217, 130, 0, 0.45)',
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.04)' : 'rgba(217, 130, 0, 0.06)',
    },
    modalOptionIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalOptionTextContainer: {
      flex: 1,
    },
    modalOptionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    modalOptionTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    recommendedBadge: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.2)' : 'rgba(217, 130, 0, 0.15)',
      borderWidth: 1,
      borderColor: colors.gold,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    recommendedBadgeText: {
      color: colors.gold,
      fontSize: 9,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    modalOptionDesc: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      lineHeight: 15,
    },
    receiptSubHeader: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: 4,
    },
    proofText: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    metaCol: {
      flex: 1,
    },
    metaLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    metaValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    thanksSection: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 2,
    },
    thanksTitle: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1,
    },
    thanksSubtitle: {
      color: colors.textMuted,
      fontSize: 9,
      fontFamily: typography.fonts.inter,
      letterSpacing: 0.8,
      marginTop: 2,
    },
    footerBranding: {
      alignItems: 'center',
      paddingTop: 6,
    },
    chirvexTagline: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      marginTop: 3,
    },
    chirvexLink: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
  });
