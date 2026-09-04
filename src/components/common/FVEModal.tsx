import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Pressable,
  BackHandler,
  Animated,
  PanResponder,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { X } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface FVEModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}

export function FVEModal({
  visible,
  onClose,
  title,
  children,
  subtitle,
}: FVEModalProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
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
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 90 || gestureState.vy > 0.65) {
          haptics.light();
          Animated.timing(translateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop tap to dismiss */}
        <Pressable style={styles.backdropTap} onPress={handleClose} />

        <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/* Native Sheet Grab Handle with Drag Gesture */}
            <View {...panResponder.panHandlers} style={styles.handleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header */}
            <View {...panResponder.panHandlers} style={styles.header}>
              <View style={styles.headerTextContainer}>
                <Text numberOfLines={1} style={styles.title}>
                  {title}
                </Text>
                {subtitle && (
                  <Text numberOfLines={1} style={styles.subtitle}>
                    {subtitle}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Native Keyboard-Aware Scrollable Sheet Body */}
            <KeyboardAwareScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={true}
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={Platform.OS === 'ios' ? 24 : 70}
              keyboardOpeningTime={0}
              enableResetScrollToCoords={false}
            >
              {children}
            </KeyboardAwareScrollView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#12151B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '92%',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 22,
    paddingBottom: 48,
  },
});
