import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Copy, Check, Maximize2, QrCode } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { formatCurrency } from '@/utils/format';
import { UPIQRCodeModal, UPI_ID } from './UPIQRCodeModal';

interface UPIPaymentQRCardProps {
  amount?: number | string;
  title?: string;
  compact?: boolean;
}

export function UPIPaymentQRCard({
  amount,
  title = 'FITVERSE ELITE UPI QR',
  compact = false,
}: UPIPaymentQRCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [copied, setCopied] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const numAmount = amount ? Number(amount) : 0;

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(UPI_ID);
      haptics.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore
    }
  };

  const handleOpenModal = () => {
    haptics.light();
    setModalVisible(true);
  };

  return (
    <>
      <View style={[styles.container, compact && styles.containerCompact]}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <QrCode size={14} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>
          {numAmount > 0 && (
            <View style={styles.amountBadge}>
              <Text style={styles.amountText}>{formatCurrency(numAmount)}</Text>
            </View>
          )}
        </View>

        {/* Content Row: QR Code preview on left/center + details */}
        <View style={styles.contentRow}>
          {/* QR Code thumbnail with tap to expand */}
          <TouchableOpacity
            onPress={handleOpenModal}
            activeOpacity={0.85}
            style={styles.qrThumbFrame}
          >
            <Image
              source={require('@/../assets/payment_upi_qr.jpg')}
              style={styles.qrThumbImage}
              resizeMode="contain"
            />
            <View style={styles.expandOverlay}>
              <Maximize2 size={12} color="#050505" />
              <Text style={styles.expandText}>ENLARGE</Text>
            </View>
          </TouchableOpacity>

          {/* Details & Actions on right */}
          <View style={styles.detailsCol}>
            <Text style={styles.instructionText}>
              Scan with Google Pay, PhonePe, Paytm, or BHIM.
            </Text>

            {/* UPI ID & Copy block */}
            <View style={styles.upiBox}>
              <Text style={styles.upiBoxLabel}>UPI ID</Text>
              <Text style={styles.upiBoxValue} numberOfLines={1}>
                {UPI_ID}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={handleCopy}
                style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
                activeOpacity={0.75}
              >
                {copied ? (
                  <>
                    <Check size={12} color="#050505" />
                    <Text style={styles.actionBtnTextSuccess}>COPIED</Text>
                  </>
                ) : (
                  <>
                    <Copy size={12} color={colors.gold} />
                    <Text style={styles.actionBtnText}>COPY ID</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenModal}
                style={styles.expandBtn}
                activeOpacity={0.75}
              >
                <Maximize2 size={12} color={colors.textPrimary} />
                <Text style={styles.expandBtnText}>VIEW QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Full-Screen Modal */}
      <UPIQRCodeModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        amount={numAmount}
        title={title}
      />
    </>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#0E1116' : colors.cardBackground,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.35)',
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
    },
    containerCompact: {
      padding: 10,
      marginBottom: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      color: colors.gold,
      letterSpacing: 0.8,
    },
    amountBadge: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(239, 161, 0, 0.12)',
      borderWidth: 1,
      borderColor: colors.gold,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    amountText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      color: colors.gold,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    qrThumbFrame: {
      width: 105,
      height: 128,
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.gold,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    qrThumbImage: {
      width: '100%',
      height: '100%',
    },
    expandOverlay: {
      position: 'absolute',
      bottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.gold,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    expandText: {
      fontSize: 9,
      fontFamily: typography.fonts.rajdhani,
      color: '#050505',
      letterSpacing: 0.5,
    },
    detailsCol: {
      flex: 1,
    },
    instructionText: {
      fontSize: typography.sizes.xs - 2,
      fontFamily: typography.fonts.inter,
      color: colors.textSecondary,
      lineHeight: 14,
      marginBottom: 8,
    },
    upiBox: {
      backgroundColor: isDark ? '#161920' : colors.surfaceMuted,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginBottom: 8,
    },
    upiBoxLabel: {
      fontSize: 8,
      fontFamily: typography.fonts.rajdhaniMedium,
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    upiBoxValue: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      color: colors.textPrimary,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.10)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.4)' : 'rgba(217, 130, 0, 0.35)',
      paddingVertical: 6,
      borderRadius: 6,
    },
    actionBtnSuccess: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    actionBtnText: {
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      color: colors.gold,
      letterSpacing: 0.5,
    },
    actionBtnTextSuccess: {
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      color: '#050505',
      letterSpacing: 0.5,
    },
    expandBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: isDark ? '#1E232C' : colors.surfaceLight,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.borderDark,
      paddingVertical: 6,
      borderRadius: 6,
    },
    expandBtnText: {
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
  });
