import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { X, User, ZoomIn, RefreshCw, Upload } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { createMemberPhotoSignedUrl, resolveMemberPhotoUrl } from '@/utils/imageUpload';

interface ProfilePhotoModalProps {
  visible: boolean;
  onClose: () => void;
  photoUrl?: string | null;
  memberName: string;
  memberId?: string | null;
  onRequestPhotoUpdate?: () => void;
}

export function ProfilePhotoModal({
  visible,
  onClose,
  photoUrl,
  memberName,
  memberId,
  onRequestPhotoUpdate,
}: ProfilePhotoModalProps) {
  const { colors, isDark } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const styles = useMemo(
    () => getStyles(colors, isDark, screenWidth, screenHeight),
    [colors, isDark, screenWidth, screenHeight]
  );

  const cleanUrl = resolveMemberPhotoUrl(photoUrl);
  const isLocalUri = Boolean(
    cleanUrl && (
      cleanUrl.startsWith('file:') ||
      cleanUrl.startsWith('content:') ||
      cleanUrl.startsWith('ph:') ||
      cleanUrl.startsWith('blob:')
    )
  );

  const [loading, setLoading] = useState(Boolean(cleanUrl));
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [imageUrl, setImageUrl] = useState(cleanUrl);
  const [triedSignedUrl, setTriedSignedUrl] = useState(false);

  // Reset loading and error states whenever modal opens or photoUrl changes
  useEffect(() => {
    if (visible) {
      setLoading(Boolean(cleanUrl));
      setHasError(false);
      setReloadKey(0);
      setImageUrl(cleanUrl);
      setTriedSignedUrl(false);
    }
  }, [visible, cleanUrl]);

  const handlePhotoLoadError = async (message?: string) => {
    // Saved public URLs are durable, but deployments may still have an older
    // private bucket configuration. Ask Storage for a fresh short-lived URL
    // once before reporting a permanent image failure.
    if (!isLocalUri && !triedSignedUrl && photoUrl) {
      setTriedSignedUrl(true);
      try {
        const signedUrl = await createMemberPhotoSignedUrl(photoUrl);
        if (signedUrl && signedUrl !== imageUrl) {
          setImageUrl(signedUrl);
          setLoading(true);
          setHasError(false);
          setReloadKey((key) => key + 1);
          return;
        }
      } catch (error) {
        console.warn('[ProfilePhotoModal] Signed photo fallback failed:', (error as Error)?.message || message);
      }
    }

    setLoading(false);
    setHasError(true);
  };

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  if (!visible) return null;

  const initial = memberName?.trim()?.charAt(0)?.toUpperCase() || 'M';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarThumbnail}>
                  {cleanUrl && !hasError ? (
                    <Image
                      source={{ uri: imageUrl || cleanUrl || '' }}
                      style={styles.thumbnailImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  )}
                </View>
                <View style={styles.headerTextWrap}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.memberName}>
                      {memberName}
                    </Text>
                    {!!memberId && (
                      <View style={styles.idBadge}>
                        <Text style={styles.idBadgeText}>{memberId}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.subtitle}>Full-size profile photo</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close photo viewer"
                accessibilityRole="button"
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Photo Viewing Area */}
            <View style={styles.imageContainer}>
              {loading && !hasError && Boolean(cleanUrl) && (
                <View style={styles.loaderOverlay}>
                  <ActivityIndicator size="large" color={colors.gold} />
                  <Text style={styles.loaderText}>Loading high-res photo...</Text>
                </View>
              )}

              {!cleanUrl ? (
                <View style={styles.errorContainer}>
                  <View
                    style={[
                      styles.errorIconCircle,
                      {
                        backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : colors.goldMuted,
                        borderColor: colors.goldBorder,
                      },
                    ]}
                  >
                    <User size={32} color={colors.gold} />
                  </View>
                  <Text style={[styles.errorText, { color: colors.textPrimary }]}>
                    No Photo Available
                  </Text>
                  <Text style={styles.errorSubtext}>
                    No profile photo has been uploaded for this member yet.
                  </Text>
                </View>
              ) : hasError ? (
                <View style={styles.errorContainer}>
                  <View style={styles.errorIconCircle}>
                    <User size={32} color={colors.error || '#EF4444'} />
                  </View>
                  <Text style={styles.errorText}>
                    {isLocalUri ? 'Local Photo Unsynced' : 'Unable to load photo'}
                  </Text>
                  <Text style={styles.errorSubtext}>
                    {isLocalUri
                      ? 'This photo was stored as a local device file and is not accessible on cloud storage. Please edit this member and re-upload their photo.'
                      : onRequestPhotoUpdate
                        ? 'The original image is unavailable. You can retry or upload a replacement photo for this member.'
                        : 'The image is either unavailable or could not be retrieved. Please check your network connection.'}
                  </Text>
                  <View style={styles.errorActions}>
                    {!isLocalUri && (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          setHasError(false);
                          setLoading(true);
                          setImageUrl(cleanUrl);
                          setTriedSignedUrl(false);
                          setReloadKey((k) => k + 1);
                        }}
                        style={styles.retryBtn}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading profile photo"
                      >
                        <RefreshCw size={14} color={colors.gold} />
                        <Text style={styles.retryBtnText}>Retry Loading</Text>
                      </TouchableOpacity>
                    )}
                    {onRequestPhotoUpdate && (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          onRequestPhotoUpdate();
                        }}
                        style={styles.retryBtn}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Upload a replacement profile photo"
                      >
                        <Upload size={14} color={colors.gold} />
                        <Text style={styles.retryBtnText}>Upload New Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <ScrollView
                  key={`scroll-${reloadKey}`}
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Image
                    key={`img-${reloadKey}-${imageUrl}`}
                    source={{
                      uri: imageUrl || cleanUrl || '',
                      cache: reloadKey > 0 ? 'reload' : 'default',
                    }}
                    style={styles.fullImage}
                    resizeMode="contain"
                    onLoad={() => setLoading(false)}
                    onError={(e) => {
                      console.warn('[ProfilePhotoModal] Photo load failed:', e.nativeEvent?.error);
                      void handlePhotoLoadError(e.nativeEvent?.error);
                    }}
                  />
                </ScrollView>
              )}
            </View>

            {/* Footer with Hint */}
            <View style={styles.footer}>
              {cleanUrl && !hasError && !loading ? (
                <View style={styles.hintRow}>
                  <ZoomIn size={14} color={colors.gold} />
                  <Text style={styles.hintText}>Pinch to zoom image</Text>
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <TouchableOpacity
                onPress={handleClose}
                style={styles.doneBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
              >
                <Text style={styles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

interface Styles {
  backdrop: ViewStyle;
  safeContainer: ViewStyle;
  card: ViewStyle;
  header: ViewStyle;
  headerLeft: ViewStyle;
  avatarThumbnail: ViewStyle;
  thumbnailImg: ImageStyle;
  avatarInitial: TextStyle;
  headerTextWrap: ViewStyle;
  nameRow: ViewStyle;
  memberName: TextStyle;
  idBadge: ViewStyle;
  idBadgeText: TextStyle;
  subtitle: TextStyle;
  closeBtn: ViewStyle;
  imageContainer: ViewStyle;
  loaderOverlay: ViewStyle;
  loaderText: TextStyle;
  errorContainer: ViewStyle;
  errorIconCircle: ViewStyle;
  errorText: TextStyle;
  errorSubtext: TextStyle;
  errorActions: ViewStyle;
  retryBtn: ViewStyle;
  retryBtnText: TextStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  fullImage: ImageStyle;
  footer: ViewStyle;
  hintRow: ViewStyle;
  hintText: TextStyle;
  doneBtn: ViewStyle;
  doneBtnText: TextStyle;
}

function getStyles(
  colors: ThemeColors,
  isDark: boolean,
  screenWidth: number,
  screenHeight: number
): Styles {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    safeContainer: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'android' ? 24 : 12,
    },
    card: {
      width: '100%',
      maxHeight: screenHeight * 0.88,
      backgroundColor: isDark ? '#0C0E12' : colors.cardBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      overflow: 'hidden',
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark,
      backgroundColor: isDark ? '#12151B' : colors.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },
    avatarThumbnail: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      overflow: 'hidden',
    },
    thumbnailImg: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    avatarInitial: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 18,
      color: colors.gold,
      fontWeight: '700',
    },
    headerTextWrap: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    memberName: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 18,
      color: colors.textPrimary,
      flexShrink: 1,
      fontWeight: '700',
    },
    idBadge: {
      backgroundColor: colors.goldMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.goldBorder,
    },
    idBadgeText: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 10,
      color: colors.gold,
      fontWeight: '700',
    },
    subtitle: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageContainer: {
      width: '100%',
      height: Math.min(screenHeight * 0.58, 560),
      backgroundColor: '#040507',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    loaderOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#040507',
      zIndex: 2,
    },
    loaderText: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 12,
      color: colors.gold,
      marginTop: 10,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    errorIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    errorText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 16,
      color: colors.error || '#EF4444',
      fontWeight: '700',
    },
    errorSubtext: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 240,
      marginTop: 4,
    },
    errorActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      paddingVertical: 7,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    retryBtnText: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: '600',
      fontFamily: typography.fonts.interMedium,
    },
    scrollView: {
      flex: 1,
      width: '100%',
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullImage: {
      width: Math.max(0, screenWidth - 40),
      height: Math.min(screenHeight * 0.55, 520),
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark,
      backgroundColor: isDark ? '#12151B' : colors.surface,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    hintText: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
    },
    doneBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldBorder,
    },
    doneBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      color: colors.gold,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
  });
}
