import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { X, User, ZoomIn } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface ProfilePhotoModalProps {
  visible: boolean;
  onClose: () => void;
  photoUrl?: string | null;
  memberName: string;
  memberId?: string | null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function ProfilePhotoModal({
  visible,
  onClose,
  photoUrl,
  memberName,
  memberId,
}: ProfilePhotoModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
                  <Text style={styles.avatarInitial}>{initial}</Text>
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
              {loading && !hasError && (
                <View style={styles.loaderOverlay}>
                  <ActivityIndicator size="large" color={colors.gold} />
                  <Text style={styles.loaderText}>Loading high-res photo...</Text>
                </View>
              )}

              {hasError || !photoUrl ? (
                <View style={styles.errorContainer}>
                  <View style={styles.errorIconCircle}>
                    <User size={32} color={colors.error || '#EF4444'} />
                  </View>
                  <Text style={styles.errorText}>Unable to load photo</Text>
                  <Text style={styles.errorSubtext}>
                    The image is either unavailable or could not be retrieved.
                  </Text>
                </View>
              ) : (
                <ScrollView
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
                    source={{ uri: photoUrl }}
                    style={styles.fullImage}
                    resizeMode="contain"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setHasError(true);
                    }}
                  />
                </ScrollView>
              )}
            </View>

            {/* Footer with Hint */}
            <View style={styles.footer}>
              <View style={styles.hintRow}>
                <ZoomIn size={14} color={colors.gold} />
                <Text style={styles.hintText}>Pinch to zoom image</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.doneBtn}
                activeOpacity={0.8}
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
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  fullImage: ImageStyle;
  footer: ViewStyle;
  hintRow: ViewStyle;
  hintText: TextStyle;
  doneBtn: ViewStyle;
  doneBtnText: TextStyle;
}

function getStyles(colors: ThemeColors, isDark: boolean): Styles {
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
      maxHeight: SCREEN_HEIGHT * 0.88,
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
      height: SCREEN_HEIGHT * 0.58,
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
      width: SCREEN_WIDTH - 40,
      height: SCREEN_HEIGHT * 0.55,
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
