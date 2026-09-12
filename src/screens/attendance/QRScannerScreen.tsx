import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { X, Flashlight, Camera, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEInput } from '@/components/common/FVEInput';
import { supabase } from '@/api/supabase';
import { visitLimitStatus, consumeVisitDay } from '@/utils/visitLimit';
import { getLocalDateStr, formatDate } from '@/utils/date';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useAuth } from '@/contexts/AuthContext';
import { haptics } from '@/utils/haptics';
import { sounds } from '@/utils/sounds';
import { Member, Membership } from '@/types';

export function QRScannerScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getScannerStyles(colors, isDark), [colors, isDark]);
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Result popup state
  const [scannedResult, setScannedResult] = useState<{
    member: Member;
    membership?: Membership | null;
    status: 'success' | 'already' | 'error';
    message: string;
  } | null>(null);

  const clearTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scannedResult) return;
    setScanned(true);
    await processCheckInCode(data.trim());
  };

  const processCheckInCode = async (rawCode: string) => {
    clearTimer();
    const cleanCode = rawCode.trim();

    try {
      // 1. Look up member: try qr_code first, then member_id (e.g. FVE-01), then id, then mobile
      let member: Member | null = null;

      const { data: mByQr } = await supabase
        .from('members')
        .select('*')
        .eq('qr_code', cleanCode)
        .maybeSingle();
      member = mByQr as Member | null;

      if (!member) {
        const { data: mById } = await supabase
          .from('members')
          .select('*')
          .ilike('member_id', cleanCode)
          .maybeSingle();
        member = mById as Member | null;
      }

      if (!member) {
        const { data: mByUuid } = await supabase
          .from('members')
          .select('*')
          .eq('id', cleanCode)
          .maybeSingle();
        member = mByUuid as Member | null;
      }

      if (!member) {
        const { data: mByPhone } = await supabase
          .from('members')
          .select('*')
          .eq('mobile', cleanCode)
          .maybeSingle();
        member = mByPhone as Member | null;
      }

      if (!member) {
        sounds.qrInvalid();
        haptics.error();
        setScannedResult({
          member: { full_name: 'Unknown Code', qr_code: cleanCode } as Member,
          status: 'error',
          message: 'No member found matching this QR code or ID.',
        });
        resetTimerRef.current = setTimeout(() => {
          setScannedResult(null);
          setScanned(false);
        }, 4000);
        return;
      }

      // 2. Look up active membership
      const today = getLocalDateStr();
      const { data: memberships } = await supabase
        .from('memberships')
        .select('*, membership_plans(*)')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const activeMs = memberships?.[0];

      if (!activeMs || activeMs.status === 'HOLD' || (activeMs.expiry_date && activeMs.expiry_date < today)) {
        sounds.qrInvalid();
        haptics.warning();
        setScannedResult({
          member,
          membership: activeMs,
          status: 'error',
          message: 'Membership is inactive or expired. Please renew.',
        });
        resetTimerRef.current = setTimeout(() => {
          setScannedResult(null);
          setScanned(false);
        }, 4000);
        return;
      }

      // 3. Check visit day limit
      const limitStatus = visitLimitStatus(activeMs);
      if (limitStatus.exhausted) {
        sounds.qrInvalid();
        haptics.warning();
        setScannedResult({
          member,
          membership: activeMs,
          status: 'error',
          message: 'Plan visit limit reached. Please renew.',
        });
        resetTimerRef.current = setTimeout(() => {
          setScannedResult(null);
          setScanned(false);
        }, 4000);
        return;
      }

      // 4. Record attendance
      const now = new Date();
      // check_in_time column is TIMESTAMPTZ — must send a full ISO timestamp
      const checkInTimestamp = now.toISOString();

      const { error: attError } = await supabase.from('attendance').insert({
        member_id: member.id,
        date: today,
        check_in_time: checkInTimestamp,
        marked_by: user?.id || null,
        check_in_method: 'QR',
        created_at: checkInTimestamp,
      });

      if (attError) {
        if (attError.code === '23505') {
          // Unique index violation: already checked in today
          sounds.checkinAlready();
          haptics.warning();
          setScannedResult({
            member,
            membership: activeMs,
            status: 'already',
            message: 'Already checked in today!',
          });
          resetTimerRef.current = setTimeout(() => {
            setScannedResult(null);
            setScanned(false);
          }, 3500);
          return;
        }
        sounds.qrInvalid();
        haptics.error();
        throw attError;
      }

      // 5. Consume visit day atomically if limited
      if (limitStatus.isLimited) {
        await consumeVisitDay(activeMs);
      }

      // Invalidate attendance logs so dashboard and attendance lists update
      qc.invalidateQueries({ queryKey: ['mobile-attendance-log'] });
      qc.invalidateQueries({ queryKey: ['mobile-recent-attendance'] });
      qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });

      sounds.checkinSuccess();
      haptics.success();
      setScannedResult({
        member,
        membership: activeMs,
        status: 'success',
        message: 'Check-in Verified! Welcome to FitVerse Elite.',
      });

      // Auto-reset after 3.5 seconds for continuous kiosk flow
      resetTimerRef.current = setTimeout(() => {
        setScannedResult(null);
        setScanned(false);
      }, 3500);
    } catch (err: unknown) {
      sounds.qrInvalid();
      haptics.error();
      setScannedResult({
        member: { full_name: 'Error' } as Member,
        status: 'error',
        message: (err as Error).message || 'Failed to process check-in',
      });
      resetTimerRef.current = setTimeout(() => {
        setScannedResult(null);
        setScanned(false);
      }, 4000);
    }
  };

  const handleNextScan = () => {
    clearTimer();
    setScannedResult(null);
    setScanned(false);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <AlertTriangle size={48} color={colors.warning} style={{ marginBottom: 16 }} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          FitVerse Elite needs your camera to scan member QR check-in codes.
        </Text>
        <FVEButton
          title="Grant Permission"
          onPress={requestPermission}
          variant="gold"
          size="md"
          style={{ marginTop: 20 }}
        />
        <FVEButton
          title="Go Back"
          onPress={() => navigation.goBack()}
          variant="outline"
          size="md"
          style={{ marginTop: 10 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay}>
        {/* Top Controls */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.controlBtn}
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.overlayTitle}>SCAN MEMBER QR</Text>

          <View style={styles.topRightControls}>
            <TouchableOpacity
              onPress={() => setTorch(!torch)}
              style={[styles.controlBtn, torch && styles.activeControlBtn]}
            >
              <Flashlight size={20} color={torch ? colors.gold : '#FFFFFF'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              style={styles.controlBtn}
            >
              <Camera size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Center Scanner Reticle */}
        <View style={styles.reticleContainer}>
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.scanInstruction}>
            Position the member QR code within the frame
          </Text>
        </View>

        {/* Bottom Manual Option */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={() => setShowManualInput(!showManualInput)}
            style={styles.manualCodeToggle}
          >
            <Text style={styles.manualCodeToggleText}>
              {showManualInput ? 'Hide Manual Code' : 'Enter QR Code Manually'}
            </Text>
          </TouchableOpacity>

          {showManualInput && (
            <View style={styles.manualInputRow}>
              <FVEInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Type member QR code..."
                containerStyle={{ flex: 1, marginBottom: 0, marginRight: 8 }}
              />
              <FVEButton
                title="Verify"
                onPress={() => {
                  if (manualCode.trim()) processCheckInCode(manualCode.trim());
                }}
                variant="gold"
                size="sm"
              />
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Result Verification Popup */}
      {scannedResult && (
        <View style={styles.resultModalBackdrop}>
          <View
            style={[
              styles.resultCard,
              scannedResult.status === 'success'
                ? styles.cardSuccess
                : scannedResult.status === 'already'
                ? styles.cardAlready
                : styles.cardError,
            ]}
          >
            {scannedResult.status === 'success' ? (
              <CheckCircle size={48} color={colors.success} style={{ marginBottom: 10 }} />
            ) : (
              <AlertTriangle
                size={48}
                color={scannedResult.status === 'already' ? colors.warning : colors.error}
                style={{ marginBottom: 10 }}
              />
            )}

            <Text style={styles.resultTitle}>{scannedResult.member.full_name}</Text>
            {scannedResult.member.member_id && (
              <Text style={styles.resultMemberId}>#{scannedResult.member.member_id}</Text>
            )}

            <Text style={styles.resultMessage}>{scannedResult.message}</Text>

            {scannedResult.membership && (
              <Text style={styles.resultExpiry}>
                Plan: {scannedResult.membership.membership_plans?.name || 'Membership'} · Valid until{' '}
                {formatDate(scannedResult.membership.expiry_date)}
              </Text>
            )}

            <FVEButton
              title="Next Scan"
              onPress={handleNextScan}
              variant="gold"
              size="sm"
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const getScannerStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    camera: {
      flex: 1,
    },
    centered: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    permissionContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    permissionTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      textAlign: 'center',
    },
    permissionSubtitle: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.inter,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    permissionText: {
      color: colors.gold,
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
    },
    overlay: {
      flex: 1,
      justifyContent: 'space-between',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    overlayTitle: {
      color: colors.gold,
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1,
    },
    topRightControls: {
      flexDirection: 'row',
      gap: 10,
    },
    controlBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    activeControlBtn: {
      borderColor: colors.gold,
      backgroundColor: colors.goldMuted,
    },
    reticleContainer: {
      alignItems: 'center',
    },
    reticle: {
      width: 250,
      height: 250,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderColor: colors.gold,
    },
    topLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 3.5,
      borderLeftWidth: 3.5,
    },
    topRight: {
      top: 0,
      right: 0,
      borderTopWidth: 3.5,
      borderRightWidth: 3.5,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 3.5,
      borderLeftWidth: 3.5,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 3.5,
      borderRightWidth: 3.5,
    },
    scanInstruction: {
      color: '#FFFFFF',
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      marginTop: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
    },
    bottomBar: {
      padding: 20,
      alignItems: 'center',
    },
    manualCodeToggle: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      borderRadius: 8,
      marginBottom: 8,
    },
    manualCodeToggleText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    manualInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    resultModalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    resultCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1.5,
      padding: 24,
      alignItems: 'center',
    },
    cardSuccess: {
      borderColor: colors.success,
    },
    cardAlready: {
      borderColor: colors.warning,
    },
    cardError: {
      borderColor: colors.error,
    },
    resultTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.xl,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      textAlign: 'center',
    },
    resultMemberId: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      marginTop: 2,
    },
    resultMessage: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.inter,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 18,
    },
    resultExpiry: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      marginTop: 6,
      textAlign: 'center',
    },
  });
