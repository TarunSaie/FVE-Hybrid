import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { Share2, ArrowLeft, CheckCircle2, FileText, Printer, Sparkles, Dumbbell, UserCheck } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEModal } from '@/components/common/FVEModal';
import { haptics } from '@/utils/haptics';
import { Payment, PersonalTraining } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency, openWhatsAppLink } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { sharePdfReceipt, printPdfReceipt, buildReceiptDataFromPayment } from '@/utils/receiptPdf';
import { RootStackParamList } from '@/navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'PaymentReceipt'>;

export function PaymentReceiptScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const payment = route.params?.payment;

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

  // Query linked personal training record if any
  const { data: ptRecord } = useQuery<PersonalTraining | null>({
    queryKey: ['payment-pt-addon', payment.id],
    queryFn: async () => {
      if (!payment.id) return null;

      // 1. Direct payment_id lookup
      const { data: pt1 } = await supabase
        .from('personal_training')
        .select('*, trainer:user_profiles!personal_training_trainer_id_fkey(*)')
        .eq('payment_id', payment.id)
        .maybeSingle();

      if (pt1) return pt1 as PersonalTraining;

      // 2. Try with trainer_id FK
      const { data: pt2 } = await supabase
        .from('personal_training')
        .select('*, trainer:user_profiles!trainer_id(*)')
        .eq('payment_id', payment.id)
        .maybeSingle();

      if (pt2) return pt2 as PersonalTraining;

      // 3. Fallback by member_id if notes indicate Personal Training
      if (payment.notes?.includes('Personal Training') && payment.member_id) {
        const { data: pt3 } = await supabase
          .from('personal_training')
          .select('*, trainer:user_profiles!personal_training_trainer_id_fkey(*)')
          .eq('member_id', payment.member_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pt3) return pt3 as PersonalTraining;
      }

      return null;
    },
    enabled: !!payment.id,
  });

  const isPT = Boolean(ptRecord || payment.notes?.includes('Personal Training'));
  const memberName = payment.members?.full_name || 'Member';
  const memberMobile = payment.members?.mobile;
  const memberId = payment.members?.member_id;
  const plan = payment.memberships?.membership_plans;
  const displayPlanName = isPT
    ? (ptRecord?.package_name ? `Personal Training — ${ptRecord.package_name}` : 'Personal Training Add-On')
    : (plan?.name || 'Gym Subscription');

  const memberDbId = payment.member_id;
  const membershipStart = payment.memberships?.start_date;
  const membershipExpiry = payment.memberships?.expiry_date;
  const visitDayLimit = payment.memberships?.visit_day_limit ?? null;

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

  const actualVisitsUsed = attendanceCount ?? payment.memberships?.visit_days_used ?? 0;
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

  const receiptNo = payment.receipt_number || 'FVE-N/A';
  const dateStr = formatDate(payment.payment_date || payment.created_at);
  const startDate = isPT && ptRecord?.start_date
    ? formatDate(ptRecord.start_date)
    : (payment.memberships?.start_date ? formatDate(payment.memberships.start_date) : null);
  const endDate = isPT && ptRecord?.expiry_date
    ? formatDate(ptRecord.expiry_date)
    : (payment.memberships?.expiry_date ? formatDate(payment.memberships.expiry_date) : null);

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const whatsAppReceiptText = isPT
    ? `*FitVerse Elite Official Receipt*\n` +
      `Receipt No: #${receiptNo}\n` +
      `Member: ${memberName}${memberId ? ` (${memberId})` : ''}\n` +
      `Service: Personal Training Add-On\n` +
      `Package: ${displayPlanName}\n` +
      (ptRecord?.trainer?.full_name ? `Trainer: ${ptRecord.trainer.full_name}\n` : '') +
      (totalPTSessions ? `Sessions: ${totalPTSessions} Sessions\n` : '') +
      (startDate && endDate ? `Validity: ${startDate} TO ${endDate}\n` : '') +
      (totalPTSessions != null
        ? `Sessions: ${totalPTSessions} sessions allotted throughout your entire subscription period.\n` +
          `${actualPTSessionsCompleted}/${totalPTSessions} sessions completed. ` +
          (remainingPTSessions != null && remainingPTSessions > 1
            ? `You can attend ${remainingPTSessions} more sessions during your plan.\n`
            : remainingPTSessions === 1
            ? `You can attend 1 more session during your plan.\n`
            : `All allotted sessions have been completed.\n`)
        : '') +
      `Amount Paid: ${formatCurrency(payment.amount)}\n` +
      `Payment Method: ${payment.payment_method?.toUpperCase() || 'CASH'}\n` +
      `Date: ${dateStr}\n\n` +
      `*THANKS FOR TRAINING WITH US*\n` +
      `DISCIPLINE • STRENGTH • TRANSFORMATION\n\n` +
      `This is an automated receipt generated and sent by Chirvex.\n` +
      `Chirvex builds high-converting websites, SEO strategies, and lead generation solutions that help businesses grow.\n` +
      `www.chirvex.in`
    : `FitVerse Elite Receipt\n` +
      `Receipt No: #${receiptNo}\n` +
      `Member: ${memberName}${memberId ? ` (${memberId})` : ''}\n` +
      `Plan: ${displayPlanName}\n` +
      (startDate && endDate ? `Validity: ${startDate} TO ${endDate}\n` : '') +
      (visitDayLimit != null
        ? `Visits: ${visitDayLimit} days allotted throughout your entire subscription period.\n` +
          `${actualVisitsUsed}/${visitDayLimit} visits used. ` +
          (remainingVisits != null && remainingVisits > 1
            ? `You can visit for ${remainingVisits} more days during your plan.\n`
            : remainingVisits === 1
            ? `You can visit for 1 more day during your plan.\n`
            : `All allotted visit days have been used.\n`)
        : '') +
      `Amount Paid: ${formatCurrency(payment.amount)}\n\n` +
      `THANKS FOR TRAINING WITH US\n` +
      `DISCIPLINE • STRENGTH • TRANSFORMATION\n\n` +
      `This is an automated receipt generated and sent by Chirvex.\n` +
      `Chirvex builds high-converting websites, SEO strategies, and lead generation solutions that help businesses grow.\n` +
      `www.chirvex.in`;

  const handleSharePdf = async () => {
    if (!payment) return;
    haptics.medium();
    setPdfGenerating(true);
    try {
      const receiptData = buildReceiptDataFromPayment(payment, ptRecord, {
        actualVisitsUsed,
        remainingVisits,
        actualPTSessionsCompleted,
        remainingPTSessions,
      });
      await sharePdfReceipt(receiptData);
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to generate receipt PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleShareBoth = async () => {
    if (!payment) return;
    setShowWhatsAppModal(false);
    haptics.medium();
    setPdfGenerating(true);
    try {
      // 1. Copy formatted text to clipboard
      await Clipboard.setStringAsync(whatsAppReceiptText);

      // 2. Generate and open PDF sharing
      const receiptData = buildReceiptDataFromPayment(payment, ptRecord, {
        actualVisitsUsed,
        remainingVisits,
        actualPTSessionsCompleted,
        remainingPTSessions,
      });
      await sharePdfReceipt(receiptData);

      // 3. User feedback
      Alert.alert(
        'Receipt Ready to Share',
        '✓ Receipt summary text copied to your clipboard!\n\nYou can paste it alongside the attached PDF invoice in WhatsApp.',
        [{ text: 'OK' }]
      );
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to share receipt');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!payment) return;
    haptics.light();
    try {
      const receiptData = buildReceiptDataFromPayment(payment, ptRecord, {
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

  const handleWhatsApp = () => {
    if (memberMobile) {
      openWhatsAppLink(memberMobile, whatsAppReceiptText);
    } else {
      Alert.alert(
        'No Mobile Number',
        'This member does not have a registered mobile number. Please update their profile with a valid WhatsApp phone.'
      );
    }
  };

  const handleNativeShare = async () => {
    if (!payment) return;
    haptics.medium();
    try {
      await Clipboard.setStringAsync(whatsAppReceiptText);
      await handleSharePdf();
    } catch {
      // Ignore
    }
  };

  const memberQrCode = payment.members?.qr_code || payment.members?.id || payment.member_id || payment.receipt_number;

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
              handleNativeShare();
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
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>PT VALIDITY PERIOD</Text>
                    <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                      {startDate} TO {endDate}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PLAN</Text>
                  <Text style={styles.detailValue}>{displayPlanName}</Text>
                </View>
                {startDate && endDate && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>VALIDITY</Text>
                    <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                      {startDate} TO {endDate}
                    </Text>
                  </View>
                )}
                {visitDayLimit != null && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>VISITS ALLOTTED</Text>
                      <Text style={[styles.detailValue, { color: colors.gold }]}>
                        {visitDayLimit} Days ({actualVisitsUsed} used)
                      </Text>
                    </View>
                    <View style={{ marginTop: 2, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 15 }}>
                        Visits: {visitDayLimit} days allotted throughout your entire subscription period.
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.gold, fontWeight: '600', marginTop: 2, lineHeight: 15 }}>
                        {actualVisitsUsed}/{visitDayLimit} visits used.{' '}
                        {remainingVisits != null && remainingVisits > 1
                          ? `You can visit for ${remainingVisits} more days during your plan.`
                          : remainingVisits === 1
                          ? `You can visit for 1 more day during your plan.`
                          : `All allotted visit days have been used.`}
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
            onPress={() => {
              haptics.medium();
              setShowWhatsAppModal(true);
            }}
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

      {/* Unified WhatsApp Sharing Modal */}
      <FVEModal
        visible={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="SHARE TO WHATSAPP"
        subtitle={`Member: ${memberName}${memberMobile ? ` (${memberMobile})` : ''}`}
      >
        <View style={styles.modalOptionList}>
          {/* Option 1: Send Both (Recommended) */}
          <TouchableOpacity
            style={[styles.modalOptionCard, styles.modalOptionCardHighlight]}
            activeOpacity={0.7}
            onPress={handleShareBoth}
          >
            <View style={[styles.modalOptionIconBox, { backgroundColor: 'rgba(239, 161, 0, 0.15)', borderColor: colors.gold }]}>
              <Sparkles size={20} color={colors.gold} />
            </View>
            <View style={styles.modalOptionTextContainer}>
              <View style={styles.modalOptionTitleRow}>
                <Text style={[styles.modalOptionTitle, { color: colors.gold }]}>Send Both (PDF & Text)</Text>
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeText}>BEST</Text>
                </View>
              </View>
              <Text style={styles.modalOptionDesc}>
                Copies receipt message to clipboard & attaches official branded PDF invoice in WhatsApp.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 2: Send PDF Document Only */}
          <TouchableOpacity
            style={styles.modalOptionCard}
            activeOpacity={0.7}
            onPress={() => {
              setShowWhatsAppModal(false);
              handleSharePdf();
            }}
          >
            <View style={[styles.modalOptionIconBox, { backgroundColor: 'rgba(239, 161, 0, 0.08)', borderColor: 'rgba(239, 161, 0, 0.3)' }]}>
              <FileText size={20} color={colors.gold} />
            </View>
            <View style={styles.modalOptionTextContainer}>
              <Text style={styles.modalOptionTitle}>Send PDF Document</Text>
              <Text style={styles.modalOptionDesc}>
                Official invoice PDF with gym logo, QR code, and full validity breakdown.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 3: Send WhatsApp Text Message Only */}
          <TouchableOpacity
            style={styles.modalOptionCard}
            activeOpacity={0.7}
            onPress={() => {
              setShowWhatsAppModal(false);
              handleWhatsApp();
            }}
          >
            <View style={[styles.modalOptionIconBox, { backgroundColor: 'rgba(37, 211, 102, 0.12)', borderColor: 'rgba(37, 211, 102, 0.3)' }]}>
              <Share2 size={20} color="#25D366" />
            </View>
            <View style={styles.modalOptionTextContainer}>
              <Text style={styles.modalOptionTitle}>Send WhatsApp Text to Member</Text>
              <Text style={styles.modalOptionDesc}>
                Opens chat directly with registered WhatsApp mobile ({memberMobile || 'N/A'}) and pre-fills payment receipt & validity text.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </FVEModal>
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
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.35)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
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
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderColor: 'rgba(239, 161, 0, 0.4)',
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
    backgroundColor: 'rgba(239, 161, 0, 0.2)',
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
    backgroundColor: '#0A0A0A',
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
    backgroundColor: '#0E1117',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  modalOptionCardHighlight: {
    borderColor: 'rgba(239, 161, 0, 0.45)',
    backgroundColor: 'rgba(239, 161, 0, 0.04)',
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
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(239, 161, 0, 0.2)',
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
    color: '#7B8088',
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  proofText: {
    color: '#7B8088',
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
    color: '#7B8088',
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
