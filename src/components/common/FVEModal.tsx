import React, { useEffect, useRef, useState } from 'react';
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

  const translateY = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);
  const [sheetHeight, setSheetHeight] = useState(0);

  // Maximum distance the sheet can travel upwards toward the top of the screen
  const maxUpDrag = Math.max(0, screenHeight - sheetHeight - topInset - 16);

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      currentOffset.current = 0;
    }
  }, [visible, translateY]);

  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => backSub.remove();
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 5 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        const offset = currentOffset.current;
        const rawTarget = offset + gestureState.dy;

        if (rawTarget < -maxUpDrag) {
          // Beyond top boundary: rubber-band resistance
          const overdrag = -maxUpDrag - rawTarget;
          translateY.setValue(-maxUpDrag - overdrag * 0.2);
        } else {
          translateY.setValue(rawTarget);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const offset = currentOffset.current;
        const dy = gestureState.dy;
        const vy = gestureState.vy;

        if (offset === 0) {
          // Currently at REST (natural content height)
          if (dy < -40 || vy < -0.45) {
            // Dragged up significantly -> Snap to TOP smoothly
            if (maxUpDrag > 25) {
              haptics.light();
              Animated.spring(translateY, {
                toValue: -maxUpDrag,
                useNativeDriver: true,
                damping: 20,
                stiffness: 150,
                mass: 0.8,
              }).start(() => {
                currentOffset.current = -maxUpDrag;
              });
            } else {
              // Already near top
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 4,
              }).start();
            }
          } else if (dy > 80 || vy > 0.6) {
            // Dragged down significantly -> Dismiss smoothly
            haptics.light();
            Animated.timing(translateY, {
              toValue: screenHeight,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              currentOffset.current = 0;
              onClose();
            });
          } else {
            // Revert back to REST position
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start(() => {
              currentOffset.current = 0;
            });
          }
        } else {
          // Currently at EXPANDED (top position)
          if (dy > 45 || vy > 0.45) {
            // Dragged down from top position
            if (dy > maxUpDrag + 80 || vy > 1.1) {
              // Dragged all the way down off screen -> Dismiss
              haptics.light();
              Animated.timing(translateY, {
                toValue: screenHeight,
                duration: 180,
                useNativeDriver: true,
              }).start(() => {
                translateY.setValue(0);
                currentOffset.current = 0;
                onClose();
              });
            } else {
              // Snap back down to REST position
              haptics.light();
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                damping: 20,
                stiffness: 150,
                mass: 0.8,
              }).start(() => {
                currentOffset.current = 0;
              });
            }
          } else {
            // Keep at EXPANDED top position
            Animated.spring(translateY, {
              toValue: -maxUpDrag,
              useNativeDriver: true,
              damping: 20,
              stiffness: 150,
            }).start(() => {
              currentOffset.current = -maxUpDrag;
            });
          }
        }
      },
    })
  ).current;

  const sheetBg = isDark ? '#12151B' : colors.cardBackground;
  const sheetBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : colors.borderDark;
  const handleBg = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.2)';
  const closeBtnBg = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.06)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        {/* Backdrop tap to dismiss */}
        <Pressable style={styles.backdropTap} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <Animated.View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0 && Math.abs(h - sheetHeight) > 2) {
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
            <View {...panResponder.panHandlers} style={styles.handleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: handleBg }]} />
            </View>

            {/* Header */}
            <View
              {...panResponder.panHandlers}
              style={[
                styles.header,
                { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDark },
              ]}
            >
              <View style={styles.headerTextContainer}>
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
                onPress={handleClose}
                style={[styles.closeButton, { backgroundColor: closeBtnBg }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    bottom: -1000,
    left: 0,
    right: 0,
    height: 1000,
    borderWidth: 1,
    borderTopWidth: 0,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
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
});
