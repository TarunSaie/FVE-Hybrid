import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
} from 'react-native';
import { colors } from '@/constants/colors';
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
  const [internalFocused, setInternalFocused] = useState(false);
  const isInputFocused = controlledFocused !== undefined ? controlledFocused : internalFocused;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isInputFocused && styles.focusedContainer,
          !!error && styles.errorContainer,
          !editable && styles.disabledContainer,
        ]}
      >
        {leftIcon && (
          <View pointerEvents="none" style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}

        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.gold}
          // Disable OS autofill grouping — prevents multi-field highlight when
          // sibling inputs are visible in the same form container.
          textContentType="none"
          importantForAutofill="no"
          autoComplete="off"
          onFocus={(e) => {
            setInternalFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setInternalFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
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
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
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
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  focusedContainer: {
    borderColor: colors.gold,
    backgroundColor: '#161A22',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  errorContainer: {
    borderColor: colors.error,
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
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.inter,
    paddingVertical: 12,
    minHeight: 48,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
    marginLeft: 2,
  },
});
