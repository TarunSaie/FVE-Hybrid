import React, { useEffect, useRef, useState, useCallback } from 'react';
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
}

export function FVEModal({
  visible,
  onClose,
  title,
  children,
  subtitle,
  maxHeight = '90%',
  scrollable = true,
  contentContainerStyle,
}: FVEModalProps) {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const topInset = Math.max(insets.top, 24);

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const currentOffset = useRef(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const isDragging = useRef(false);
  const isClosingRef = useRef(false);

  // Maximum distance the sheet can travel upwards toward the top of the screen
  const maxUpDrag = Math.max(0, screenHeight - sheetHeight - topInset - 16);

  const closeWithAnimation = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    haptics.light();
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      // Keep offscreen position so it never flashes back to 0 before unmounting
      setTimeout(() => {
        isClosingRef.current = false;
      }, 150);
    });
  }, [screenHeight, onClose, translateY]);

  // Synchronously keep live parameters updated on every render to eliminate stale closures
  const paramsRef = useRef({
    maxUpDrag: Math.round(screenHeight * 0.45),
    screenHeight,
    closeWithAnimation,
  });
  paramsRef.current = {
    maxUpDrag: maxUpDrag > 20 ? maxUpDrag : Math.round(screenHeight * 0.45),
    screenHeight,
    closeWithAnimation,
  };

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
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = true;
        translateY.stopAnimation();
        // @ts-ignore - access synchronous current animated value safely
        const liveVal =
          typeof (translateY as any)._value === 'number'
            ? (translateY as any)._value
            : currentOffset.current;
        currentOffset.current = liveVal;
      },
      onPanResponderMove: (_, gestureState) => {
        const { maxUpDrag: maxUp } = paramsRef.current;
        const target = currentOffset.current + gestureState.dy;

        if (target < -maxUp) {
          // Dragging above top limit: apply rubber-band damping
          const over = -maxUp - target;
          translateY.setValue(-maxUp - over * 0.25);
        } else {
          translateY.setValue(target);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        isDragging.current = false;
        const { maxUpDrag: maxUp, closeWithAnimation: closeAnim } = paramsRef.current;
        const startOffset = currentOffset.current;
        const dy = gestureState.dy;
        const vy = gestureState.vy;
        const endPosition = startOffset + dy;

        // Quick tap on handle (minimal movement): toggle between REST and TOP
        if (Math.abs(dy) < 6 && Math.abs(vy) < 0.15) {
          if (startOffset === 0 && maxUp > 30) {
            haptics.light();
            Animated.spring(translateY, {
              toValue: -maxUp,
              useNativeDriver: true,
              damping: 20,
              stiffness: 160,
              mass: 0.8,
            }).start(() => {
              currentOffset.current = -maxUp;
            });
            return;
          } else if (startOffset < -20) {
            haptics.light();
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 20,
              stiffness: 160,
              mass: 0.8,
            }).start(() => {
              currentOffset.current = 0;
            });
            return;
          }
        }

        // 1. DISMISS CONDITION:
        // Dragged down past rest position by > 75px or strong downward flick
        if (endPosition > 75 || (vy > 0.6 && endPosition > -30)) {
          closeAnim();
          return;
        }

        // 2. EXPAND TO TOP CONDITION:
        // Strong upward flick or dragged past 35% of upward travel
        if (maxUp > 30 && (vy < -0.4 || endPosition < -maxUp * 0.35)) {
          haptics.light();
          Animated.spring(translateY, {
            toValue: -maxUp,
            useNativeDriver: true,
            damping: 20,
            stiffness: 160,
            mass: 0.8,
          }).start(() => {
            currentOffset.current = -maxUp;
          });
          return;
        }

        // 3. COLLAPSE TO REST POSITION (Default):
        haptics.light();
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 160,
          mass: 0.8,
        }).start(() => {
          currentOffset.current = 0;
        });
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(translateY, {
          toValue: currentOffset.current,
          useNativeDriver: true,
          damping: 20,
          stiffness: 160,
        }).start();
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [-maxUpDrag - 40, 0, screenHeight * 0.75],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  const sheetBg = isDark ? '#12151B' : colors.cardBackground;
  const sheetBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : colors.borderDark;
  const handleBg = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.2)';
  const closeBtnBg = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.06)';

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
            onLayout={(e) => {
              if (isDragging.current) return;
              const h = e.nativeEvent.layout.height;
              if (h > 0 && Math.abs(h - sheetHeight) > 4) {
                setSheetHeight(h);
              }
            }}
            style={[
              styles.sheet,
              {
                backgroundColor: sheetBg,
                borderColor: sheetBorder,
                maxHeight,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Seamless Bottom Skirt to prevent any gap when dragged towards top */}
            <View
              pointerEvents="none"
              style={[
                styles.bottomSkirt,
                {
                  backgroundColor: sheetBg,
                  borderColor: sheetBorder,
                },
              ]}
            />

            {/* Native Sheet Grab Handle with Drag Gesture */}
            <View
              {...panResponder.panHandlers}
              style={styles.handleContainer}
              hitSlop={{ top: 10, bottom: 10 }}
            >
              <View style={[styles.sheetHandle, { backgroundColor: handleBg }]} />
            </View>

            {/* Header */}
            <View
              style={[
                styles.header,
                { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark },
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

            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={[
                  styles.bodyContent,
                  { paddingBottom: bottomInset + 12 },
                  contentContainerStyle,
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.body,
                  styles.bodyContent,
                  { paddingBottom: bottomInset + 12 },
                  contentContainerStyle,
                ]}
              >
                {children}
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
  bottomSkirt: {
    position: 'absolute',
    bottom: -1200,
    left: 0,
    right: 0,
    height: 1200,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderTopWidth: 0,
  },
  handleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    width: '100%',
  },
  sheetHandle: {
    width: 48,
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
});
