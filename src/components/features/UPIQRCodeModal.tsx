import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { X, Copy, Check, QrCode, ShieldCheck } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { formatCurrency } from '@/utils/format';

interface UPIQRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  amount?: number | string;
  title?: string;
  subtitle?: string;
}

export const UPI_ID = 'fitverseelite@okaxis';

export function UPIQRCodeModal({
  visible,
  onClose,
  amount,
  title = 'SCAN TO PAY VIA UPI',
  subtitle = 'FitVerse Elite Official Merchant QR',
}: UPIQRCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const numAmount = amount ? Number(amount) : 0;

  const handleCopyUPI = async () => {
    try {
      await Clipboard.setStringAsync(UPI_ID);
      haptics.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.iconCircle}>
                  <QrCode size={18} color={colors.gold} />
                </View>
                <View>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onClose();
                }}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Optional Amount Pill */}
            {numAmount > 0 && (
              <View style={styles.amountPill}>
                <Text style={styles.amountPillLabel}>AMOUNT PAYABLE:</Text>
                <Text style={styles.amountPillVal}>{formatCurrency(numAmount)}</Text>
              </View>
            )}

            {/* QR Code Container */}
            <View style={styles.qrImageFrame}>
              <Image
                source={require('@/../assets/payment_upi_qr.jpg')}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>

            {/* UPI ID Row */}
            <View style={styles.upiIdContainer}>
              <View style={styles.upiTextBlock}>
                <Text style={styles.upiLabel}>OFFICIAL UPI ID</Text>
                <Text style={styles.upiIdText} selectable>
                  {UPI_ID}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleCopyUPI}
                style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
                activeOpacity={0.8}
              >
                {copied ? (
                  <>
                    <Check size={14} color="#050505" />
                    <Text style={styles.copyBtnTextSuccess}>COPIED</Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color="#050505" />
                    <Text style={styles.copyBtnText}>COPY ID</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Supported Apps Banner */}
            <View style={styles.appBanner}>
              <ShieldCheck size={14} color={colors.gold} />
              <Text style={styles.appBannerText}>
                Works with Google Pay, PhonePe, Paytm, BHIM & all UPI apps
              </Text>
            </View>

            {/* Close / Done Button */}
            <TouchableOpacity
              onPress={() => {
                haptics.medium();
                onClose();
              }}
              style={styles.doneBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>DONE / DISMISS</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width * 0.78, 300);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F1216',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.35)',
    padding: 18,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    color: colors.gold,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: typography.sizes.xs - 1,
    fontFamily: typography.fonts.inter,
    color: colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  amountPillLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhaniMedium,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  amountPillVal: {
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.rajdhani,
    color: colors.gold,
  },
  qrImageFrame: {
    width: QR_SIZE,
    height: QR_SIZE * 1.35,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  upiIdContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161A22',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  upiTextBlock: {
    flex: 1,
    marginRight: 10,
  },
  upiLabel: {
    fontSize: typography.sizes.xs - 2,
    fontFamily: typography.fonts.rajdhaniMedium,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  upiIdText: {
    fontSize: typography.sizes.xs + 1,
    fontFamily: typography.fonts.rajdhani,
    color: colors.textPrimary,
    marginTop: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyBtnSuccess: {
    backgroundColor: colors.success,
  },
  copyBtnText: {
    fontSize: typography.sizes.xs - 1,
    fontFamily: typography.fonts.rajdhani,
    color: '#050505',
    letterSpacing: 0.5,
  },
  copyBtnTextSuccess: {
    fontSize: typography.sizes.xs - 1,
    fontFamily: typography.fonts.rajdhani,
    color: '#050505',
    letterSpacing: 0.5,
  },
  appBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 6,
  },
  appBannerText: {
    fontSize: typography.sizes.xs - 1,
    fontFamily: typography.fonts.inter,
    color: colors.textSecondary,
    flex: 1,
  },
  doneBtn: {
    width: '100%',
    marginTop: 16,
    backgroundColor: '#1E232B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: typography.sizes.xs + 1,
    fontFamily: typography.fonts.rajdhani,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
});
