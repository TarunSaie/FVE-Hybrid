import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Copy, Check, Share2, QrCode, ShieldCheck, Sparkles } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { FVEHeader } from '@/components/common/FVEHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

export const UPI_ID = 'fitverseelite@okaxis';
export const MERCHANT_NAME = 'FITVERSE ELITE';

export function PaymentQRScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [copied, setCopied] = useState(false);

  const handleCopyUPI = async () => {
    try {
      await Clipboard.setStringAsync(UPI_ID);
      haptics.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback
    }
  };

  const handleShareUPI = async () => {
    try {
      haptics.light();
      await Share.share({
        title: 'FitVerse Elite Payment UPI',
        message: `FitVerse Elite Official UPI ID: ${UPI_ID}\nScan or enter this UPI ID in Google Pay, PhonePe, Paytm, or BHIM to pay.`,
      });
    } catch {
      // User cancelled
    }
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="PAYMENT QR"
        subtitle="FitVerse Elite Official Merchant QR"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={handleShareUPI}
            style={styles.headerShareBtn}
            activeOpacity={0.75}
          >
            <Share2 size={16} color={colors.gold} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main QR Card */}
        <View style={styles.card}>
          {/* Top Merchant Badge */}
          <View style={styles.merchantHeader}>
            <View style={styles.merchantIconCircle}>
              <QrCode size={20} color={colors.gold} />
            </View>
            <View style={styles.merchantInfo}>
              <View style={styles.verifiedRow}>
                <Text style={styles.merchantTitle}>{MERCHANT_NAME}</Text>
                <View style={styles.verifiedPill}>
                  <ShieldCheck size={11} color={colors.success} />
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>
              <Text style={styles.merchantSub}>Official Merchant • Axis Bank</Text>
            </View>
          </View>

          {/* Static QR Code Image Frame */}
          <View style={styles.qrImageFrame}>
            <Image
              source={require('@/../assets/payment_upi_qr.jpg')}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          {/* UPI ID Display & Copy Card */}
          <View style={styles.upiContainer}>
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

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleCopyUPI}
              style={styles.secondaryActionBtn}
              activeOpacity={0.75}
            >
              <Copy size={15} color={colors.gold} />
              <Text style={styles.secondaryActionText}>Copy UPI ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShareUPI}
              style={styles.secondaryActionBtn}
              activeOpacity={0.75}
            >
              <Share2 size={15} color={colors.gold} />
              <Text style={styles.secondaryActionText}>Share Info</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Accepted Payment Apps Banner */}
        <View style={styles.appsCard}>
          <View style={styles.appsHeader}>
            <Sparkles size={14} color={colors.gold} />
            <Text style={styles.appsTitle}>ACCEPTED PAYMENT METHODS</Text>
          </View>
          <Text style={styles.appsBody}>
            Scan with any UPI app on your phone: Google Pay, PhonePe, Paytm, BHIM, Cred, Amazon Pay, Navi, and all bank UPI applications.
          </Text>
          <View style={styles.pillsWrap}>
            {['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Cred', 'All UPI'].map((app) => (
              <View key={app} style={styles.appPill}>
                <Text style={styles.appPillText}>{app}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Staff Reception Desk Helper Note */}
        <View style={styles.deskCard}>
          <Text style={styles.deskNote}>
            💡 Front Desk Tip: Present this screen to members or walk-in clients to collect membership fees, personal training charges, or renew expired memberships instantly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');
const QR_CARD_WIDTH = Math.min(width - 32, 380);
const QR_FRAME_SIZE = Math.min(QR_CARD_WIDTH - 32, 290);

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerShareBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: QR_CARD_WIDTH,
      backgroundColor: isDark ? '#0E1116' : colors.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.35)',
      padding: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: isDark ? colors.gold : '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.25 : 0.08,
          shadowRadius: 14,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    merchantHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
    },
    merchantIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.10)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : 'rgba(217, 130, 0, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    merchantInfo: {
      flex: 1,
    },
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    merchantTitle: {
      fontSize: typography.sizes.md,
      fontFamily: typography.fonts.rajdhani,
      color: colors.gold,
      letterSpacing: 1,
    },
    verifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.successMuted,
      borderWidth: 1,
      borderColor: colors.successBorder,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    verifiedText: {
      fontSize: 9,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.success,
      letterSpacing: 0.5,
    },
    merchantSub: {
      fontSize: typography.sizes.xs - 1,
      fontFamily: typography.fonts.inter,
      color: colors.textSecondary,
      marginTop: 2,
    },
    qrImageFrame: {
      width: QR_FRAME_SIZE,
      height: QR_FRAME_SIZE * 1.32,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      padding: 6,
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
    upiContainer: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#161A22' : colors.surfaceMuted,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : 'rgba(217, 130, 0, 0.25)',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 14,
    },
    upiTextBlock: {
      flex: 1,
      marginRight: 10,
    },
    upiLabel: {
      fontSize: 9,
      fontFamily: typography.fonts.rajdhaniMedium,
      color: colors.textMuted,
      letterSpacing: 0.8,
    },
    upiIdText: {
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      color: colors.textPrimary,
      marginTop: 2,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.gold,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    copyBtnSuccess: {
      backgroundColor: colors.success,
    },
    copyBtnText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      color: '#050505',
      letterSpacing: 0.5,
    },
    copyBtnTextSuccess: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      color: '#050505',
      letterSpacing: 0.5,
    },
    actionRow: {
      width: '100%',
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    secondaryActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? '#161A22' : colors.surfaceLight,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.borderDark,
      paddingVertical: 10,
      borderRadius: 10,
    },
    secondaryActionText: {
      fontSize: typography.sizes.xs + 1,
      fontFamily: typography.fonts.rajdhani,
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    appsCard: {
      width: '100%',
      maxWidth: QR_CARD_WIDTH,
      backgroundColor: isDark ? '#0E1116' : colors.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
      padding: 14,
      marginTop: 14,
    },
    appsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    appsTitle: {
      fontSize: typography.sizes.xs - 1,
      fontFamily: typography.fonts.rajdhani,
      color: colors.gold,
      letterSpacing: 0.8,
    },
    appsBody: {
      fontSize: typography.sizes.xs - 1,
      fontFamily: typography.fonts.inter,
      color: colors.textSecondary,
      lineHeight: 16,
      marginBottom: 10,
    },
    pillsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    appPill: {
      backgroundColor: isDark ? '#161920' : colors.surfaceMuted,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    appPillText: {
      fontSize: typography.sizes.xs - 2,
      fontFamily: typography.fonts.rajdhaniMedium,
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    deskCard: {
      width: '100%',
      maxWidth: QR_CARD_WIDTH,
      marginTop: 12,
      paddingHorizontal: 6,
    },
    deskNote: {
      fontSize: typography.sizes.xs - 2,
      fontFamily: typography.fonts.inter,
      color: colors.textMuted,
      lineHeight: 16,
      textAlign: 'center',
    },
  });
