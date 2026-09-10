import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  Pressable,
  Keyboard,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';

export interface FVEInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  isFocused?: boolean;
}

// Global Focus Coordinator
type FocusListener = (activeId: string | null) => void;
const focusListeners = new Set<FocusListener>();
let activeInputId: string | null = null;

function broadcastFocus(id: string | null) {
  activeInputId = id;
  focusListeners.forEach((listener) => listener(id));
}

// Clear focus outline when soft keyboard closes
Keyboard.addListener(
  Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
  () => {
    broadcastFocus(null);
  }
);

export const FVEInput = forwardRef<TextInput, FVEInputProps>(function FVEInput(
  {
    label,
    error,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    style,
    onFocus,
    onBlur,
    editable = true,
    isFocused: controlledFocused,
    ...rest
  },
  ref
) {
  const { colors, isDark } = useTheme();
  const inputId = useRef(`fve_input_${Math.random().toString(36).substring(2, 9)}`).current;
  const internalRef = useRef<TextInput | null>(null);
  const [internalFocused, setInternalFocused] = useState(false);

  // Subscribe to global focus coordinator
  useEffect(() => {
    const listener: FocusListener = (currentActiveId) => {
      setInternalFocused(currentActiveId === inputId);
    };
    focusListeners.add(listener);
    return () => {
      focusListeners.delete(listener);
      if (activeInputId === inputId) {
        activeInputId = null;
      }
    };
  }, [inputId]);

  // Combine forwarded ref and internal ref
  const setCombinedRef = useCallback(
    (node: TextInput | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<TextInput | null>).current = node;
      }
    },
    [ref]
  );

  const isInputFocused = controlledFocused !== undefined ? controlledFocused : internalFocused;

  const handleContainerPress = () => {
    if (editable) {
      internalRef.current?.focus();
    }
  };

  const containerBg = isDark
    ? isInputFocused
      ? '#161A22'
      : '#11141A'
    : isInputFocused
    ? '#FFFFFF'
    : '#F8FAFC';

  const containerBorder = isDark
    ? isInputFocused
      ? colors.gold
      : 'rgba(255, 255, 255, 0.1)'
    : isInputFocused
    ? colors.gold
    : colors.borderDark;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      <Pressable
        onPress={handleContainerPress}
        style={[
          styles.inputContainer,
          {
            backgroundColor: containerBg,
            borderColor: containerBorder,
          },
          isInputFocused && {
            borderColor: colors.gold,
            shadowColor: colors.gold,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isDark ? 0.35 : 0.2,
            shadowRadius: 6,
            elevation: 2,
          },
          !!error && { borderColor: colors.error },
          !editable && styles.disabledContainer,
        ]}
      >
        {leftIcon && (
          <View pointerEvents="none" style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}

        <TextInput
          ref={setCombinedRef}
          editable={editable}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.gold}
          cursorColor={colors.gold}
          textContentType="none"
          importantForAutofill="no"
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          selectTextOnFocus={false}
          onFocus={(e) => {
            broadcastFocus(inputId);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            if (activeInputId === inputId) {
              broadcastFocus(null);
            }
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
            },
            style,
          ]}
          {...rest}
        />

        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIconContainer}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </Pressable>

      {!!error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhaniMedium,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  leftIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    marginLeft: 10,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.inter,
    paddingVertical: 12,
    minHeight: 46,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
    marginLeft: 2,
  },
});
