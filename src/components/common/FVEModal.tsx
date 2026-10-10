import React, { useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  BackHandler,
  Animated,
  PanResponder,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface FVEModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  subtitle?: string;
  maxHeight?: number | `${number}%`;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
}

export function FVEModal({
  visible,
  onClose,
  title,
  children,
  subtitle,
  maxHeight,
  scrollable = true,
  contentContainerStyle,
  footer,
}: FVEModalProps) {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);

  // Default long-sheet height is ~85% of screen; short sheets dynamically size to content
  const resolvedMaxHeight = maxHeight ?? Math.round(screenHeight * 0.85);

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const currentOffset = useRef(0);
  const isClosingRef = useRef(false);

  const closeWithAnimation = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    haptics.light();
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      setTimeout(() => {
        isClosingRef.current = false;
      }, 100);
    });
  }, [screenHeight, onClose, translateY]);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(screenHeight);
      currentOffset.current = 0;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 200,
        mass: 0.8,
      }).start();
    } else {
      translateY.setValue(screenHeight);
      currentOffset.current = 0;
      isClosingRef.current = false;
    }
  }, [visible, screenHeight, translateY]);

  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeWithAnimation();
      return true;
    });
    return () => backSub.remove();
  }, [visible, closeWithAnimation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 4 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 4 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
        // @ts-ignore - access synchronous current animated value safely
        const liveVal =
          typeof (translateY as any)._value === 'number'
            ? (translateY as any)._value
            : currentOffset.current;
        currentOffset.current = liveVal;
      },
      onPanResponderMove: (_, gestureState) => {
        const dy = gestureState.dy;
        if (dy > 0) {
          // Dragging down: direct tracking
          translateY.setValue(dy);
        } else {
          // Dragging up towards top: rubber-band resistance (max ~28px upward displacement)
          // Short sheets size to content and never jump/expand to leave empty space
          const upwardTravel = Math.max(-28, dy * 0.18);
          translateY.setValue(upwardTravel);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const dy = gestureState.dy;
        const vy = gestureState.vy;

        // Dismiss if dragged down by > 75px or strong downward flick
        if (dy > 75 || (vy > 0.55 && dy > 20)) {
          closeWithAnimation();
          return;
        }

        // Return to resting position (0) smoothly
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 220,
          mass: 0.8,
        }).start(() => {
          currentOffset.current = 0;
        });
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 220,
        }).start(() => {
          currentOffset.current = 0;
        });
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [-30, 0, screenHeight * 0.7],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  // Theme surface color (never pure white, even in light theme)
  const sheetBg = colors.surface;
  const sheetBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight;
  const handleBg = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.2)';
  const closeBtnBg = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.06)';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeWithAnimation}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Animated Dim Backdrop */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.overlay,
              opacity: backdropOpacity,
            },
          ]}
        />

        {/* Backdrop tap to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: sheetBg,
                borderColor: sheetBorder,
                maxHeight: resolvedMaxHeight,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Native Sheet Grab Handle with Drag Gesture */}
            <View
              {...panResponder.panHandlers}
              style={styles.handleContainer}
              hitSlop={{ top: 12, bottom: 12 }}
            >
              <View style={[styles.sheetHandle, { backgroundColor: handleBg }]} />
            </View>

            {/* Header */}
            <View
              style={[
                styles.header,
                { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight },
              ]}
            >
              <View {...panResponder.panHandlers} style={styles.headerTextContainer}>
                <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
                  {title}
                </Text>
                {subtitle && (
                  <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {subtitle}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={closeWithAnimation}
                style={[styles.closeButton, { backgroundColor: closeBtnBg }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Dynamic Content: short sheets size to content, long sheets scroll up to max 85% */}
            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={[
                  styles.bodyContent,
                  { paddingBottom: footer ? 16 : bottomInset + 16 },
                  contentContainerStyle,
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.body,
                  styles.bodyContent,
                  { paddingBottom: footer ? 16 : bottomInset + 16 },
                  contentContainerStyle,
                ]}
              >
                {children}
              </View>
            )}

            {/* Sticky Sheet Footer */}
            {footer && (
              <View
                style={[
                  styles.footerContainer,
                  {
                    paddingBottom: bottomInset + 8,
                    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
                    backgroundColor: sheetBg,
                  },
                ]}
              >
                {footer}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
