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

  const receiptNo = payment.receipt_number || 'FVE-N/A';
  const dateStr = formatDate(payment.payment_date || payment.created_at);
  const startDate = isPT && ptRecord?.start_date
    ? formatDate(ptRecord.start_date)
    : (payment.memberships?.start_date ? formatDate(payment.memberships.start_date) : null);
  const endDate = isPT && ptRecord?.expiry_date
    ? formatDate(ptRecord.expiry_date)
    : (payment.memberships?.expiry_date ? formatDate(payment.memberships.expiry_date) : null);
  const validityLine = startDate && endDate ? `Validity: ${startDate} TO ${endDate}\n` : '';

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const whatsAppReceiptText = isPT
    ? `*FitVerse Elite Official Receipt*\n` +
      `Receipt No: #${receiptNo}\n` +
      `Member: ${memberName}${memberId ? ` (${memberId})` : ''}\n` +
      `Service: Personal Training Add-On\n` +
      `Package: ${displayPlanName}\n` +
      (ptRecord?.trainer?.full_name ? `Trainer: ${ptRecord.trainer.full_name}\n` : '') +
      (ptRecord?.total_sessions ? `Sessions: ${ptRecord.total_sessions} Guided Sessions\n` : '') +
      (startDate && endDate ? `Validity: ${startDate} TO ${endDate}\n` : '') +
      `Amount Paid: ${formatCurrency(payment.amount)}\n` +
      `Payment Method: ${payment.payment_method}\n` +
      `Date: ${dateStr}\n\n` +
      `*DISCIPLINE • STRENGTH • TRANSFORMATION*\n` +
      `FitVerse Elite Gym Management\n` +
      `Powered by Chirvex (https://chirvex.in/)`
    : `*FitVerse Elite Official Receipt*\n` +
      `Receipt No: #${receiptNo}\n` +
      `Member: ${memberName}${memberId ? ` (${memberId})` : ''}\n` +
      `Plan: ${displayPlanName}\n` +
      validityLine +
      `Amount Paid: ${formatCurrency(payment.amount)}\n` +
      `Payment Method: ${payment.payment_method}\n` +
      `Date: ${dateStr}\n\n` +
      `*DISCIPLINE • STRENGTH • TRANSFORMATION*\n` +
      `FitVerse Elite Gym Management\n` +
      `Powered by Chirvex (https://chirvex.in/)`;

  const handleSharePdf = async () => {
    if (!payment) return;
    haptics.medium();
    setPdfGenerating(true);
    try {
      const receiptData = buildReceiptDataFromPayment(payment, ptRecord);
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
      const receiptData = buildReceiptDataFromPayment(payment, ptRecord);
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
      const receiptData = buildReceiptDataFromPayment(payment, ptRecord);
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
            <Text style={styles.brandTagline}>DISCIPLINE • STRENGTH • TRANSFORMATION</Text>
            
            {isPT ? (
              <View style={styles.ptTag}>
                <Dumbbell size={12} color={colors.gold} />
                <Text style={styles.ptTagText}>PERSONAL TRAINING ADD-ON</Text>
              </View>
            ) : null}

            <View style={styles.successTag}>
              <CheckCircle2 size={14} color={colors.success} />
              <Text style={styles.successTagText}>PAYMENT COMPLETED</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Amount Showcase */}
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>AMOUNT RECEIVED</Text>
            <Text style={styles.amountValue}>{formatCurrency(payment.amount)}</Text>
            <Text style={styles.receiptNumber}>Receipt #{receiptNo}</Text>
          </View>

          <View style={styles.divider} />

          {/* Details Table */}
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>MEMBER NAME</Text>
              <Text style={styles.detailValue}>{memberName}</Text>
            </View>

            {memberId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>MEMBER ID</Text>
                <Text style={styles.detailValue}>#{memberId}</Text>
              </View>
            )}

            {isPT ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>SERVICE</Text>
                  <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                    Personal Training Add-On
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PACKAGE</Text>
                  <Text style={styles.detailValue}>{displayPlanName}</Text>
                </View>
                {ptRecord?.trainer?.full_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TRAINER</Text>
                    <Text style={[styles.detailValue, { color: colors.gold, fontWeight: '700' }]}>
                      {ptRecord.trainer.full_name}
                    </Text>
                  </View>
                )}
                {ptRecord?.total_sessions != null && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TOTAL SESSIONS</Text>
                    <Text style={styles.detailValue}>
                      {ptRecord.total_sessions} Guided Sessions
                    </Text>
                  </View>
                )}
                {startDate && endDate && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>PT VALIDITY</Text>
                    <Text style={styles.detailValue}>
                      {startDate} - {endDate}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>MEMBERSHIP PLAN</Text>
                  <Text style={styles.detailValue}>{displayPlanName}</Text>
                </View>
                {startDate && endDate && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>VALIDITY</Text>
                    <Text style={styles.detailValue}>
                      {startDate} - {endDate}
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PAYMENT METHOD</Text>
              <Text style={styles.detailValue}>{payment.payment_method || 'CASH'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>DATE & TIME</Text>
              <Text style={styles.detailValue}>{dateStr}</Text>
            </View>

            {payment.transaction_reference && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>TXN REFERENCE</Text>
                <Text style={styles.detailValue}>{payment.transaction_reference}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Receipt QR Code */}
          {payment.receipt_number && (
            <View style={styles.qrSection}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={`FVE-RECEIPT:${payment.receipt_number}:${payment.amount}`}
                  size={100}
                  color={colors.gold}
                  backgroundColor="#0A0A0A"
                />
              </View>
              <Text style={styles.qrFooterText}>Scan to verify authentic receipt</Text>
            </View>
          )}

          {/* Footer Branding */}
          <Text style={styles.receiptFooter}>
            FitVerse Elite SaaS · Powered by Chirvex (chirvex.in)
          </Text>
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
});
