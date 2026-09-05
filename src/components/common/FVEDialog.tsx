import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  BackHandler,
  Dimensions,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  LogOut,
  Trash2,
  HelpCircle,
} from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { FVEButton } from './FVEButton';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'danger' | 'confirm';

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface FVEDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: DialogType;
  buttons?: DialogButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

export function FVEDialog({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK', style: 'default' }],
  cancelable = true,
  onDismiss,
}: FVEDialogProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      haptics.light();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          speed: 24,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  // Handle Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cancelable) {
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        if (cancelBtn?.onPress) {
          cancelBtn.onPress();
        } else if (onDismiss) {
          onDismiss();
        }
      }
      return true;
    });
    return () => backSub.remove();
  }, [visible, cancelable, buttons, onDismiss]);

  if (!visible) return null;

  // Infer visual theme based on dialog type & buttons
  const isDestructive =
    type === 'danger' ||
    buttons.some((b) => b.style === 'destructive') ||
    title.toLowerCase().includes('delete') ||
    title.toLowerCase().includes('sign out') ||
    title.toLowerCase().includes('logout');

  const isSuccess =
    type === 'success' ||
    title.toLowerCase().includes('success') ||
    title.toLowerCase().includes('switched') ||
    title.toLowerCase().includes('recorded');

  const isWarning =
    type === 'warning' ||
    title.toLowerCase().includes('warning') ||
    title.toLowerCase().includes('restricted');

  const isError =
    type === 'error' ||
    title.toLowerCase().includes('error') ||
    title.toLowerCase().includes('failed');

  const renderIcon = () => {
    if (title.toLowerCase().includes('sign out') || title.toLowerCase().includes('logout')) {
      return (
        <View style={[styles.iconHalo, styles.dangerHalo]}>
          <LogOut size={28} color={colors.error} />
        </View>
      );
    }
    if (title.toLowerCase().includes('delete')) {
      return (
        <View style={[styles.iconHalo, styles.dangerHalo]}>
          <Trash2 size={28} color={colors.error} />
        </View>
      );
    }
    if (isDestructive || isError) {
      return (
        <View style={[styles.iconHalo, styles.dangerHalo]}>
          <AlertCircle size={28} color={colors.error} />
        </View>
      );
    }
    if (isWarning) {
      return (
        <View style={[styles.iconHalo, styles.warningHalo]}>
          <AlertTriangle size={28} color={colors.warning} />
        </View>
      );
    }
    if (isSuccess) {
      return (
        <View style={[styles.iconHalo, styles.successHalo]}>
          <CheckCircle2 size={28} color={colors.success} />
        </View>
      );
    }
    if (buttons.length > 1) {
      return (
        <View style={[styles.iconHalo, styles.goldHalo]}>
          <HelpCircle size={28} color={colors.gold} />
        </View>
      );
    }
    return (
      <View style={[styles.iconHalo, styles.goldHalo]}>
        <Info size={28} color={colors.gold} />
      </View>
    );
  };

  const handleButtonPress = (btn: DialogButton) => {
    haptics.selection();
    if (btn.onPress) {
      btn.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleBackdropPress = () => {
    if (cancelable) {
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      if (cancelBtn?.onPress) {
        cancelBtn.onPress();
      }
      if (onDismiss) {
        onDismiss();
      }
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        </Animated.View>

        {/* Dialog Card */}
        <Animated.View
          style={[
            styles.card,
            isDestructive && styles.cardDestructive,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top subtle highlight */}
          <View style={[styles.glowLine, isDestructive && styles.glowLineDanger]} />

          {/* Icon Header */}
          <View style={styles.iconContainer}>{renderIcon()}</View>

          {/* Title & Message */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonContainer,
              buttons.length === 2 && styles.buttonContainerRow,
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDanger = btn.style === 'destructive';
              const variant = isDanger ? 'danger' : isCancel ? 'outline' : 'gold';

              return (
                <View
                  key={`${btn.text}-${index}`}
                  style={[
                    styles.buttonWrapper,
                    buttons.length === 2 && styles.buttonWrapperRow,
                  ]}
                >
                  <FVEButton
                    title={btn.text}
                    variant={variant}
                    size="md"
                    onPress={() => handleButtonPress(btn)}
                  />
                </View>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  card: {
    width: Math.min(width - 48, 350),
    backgroundColor: '#12151B',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 161, 0, 0.28)',
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
  },
  cardDestructive: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  glowLine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.8,
  },
  glowLineDanger: {
    backgroundColor: colors.error,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldHalo: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  dangerHalo: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  warningHalo: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  successHalo: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.inter,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  buttonContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonWrapper: {
    width: '100%',
  },
  buttonWrapperRow: {
    flex: 1,
  },
});
