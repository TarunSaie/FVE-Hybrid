import React, { forwardRef } from 'react';
import {
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  ScrollViewProps,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface FVEKeyboardAwareContainerProps extends ScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraScrollHeight?: number;
}

export const FVEKeyboardAwareContainer = forwardRef<ScrollView, FVEKeyboardAwareContainerProps>(
  function FVEKeyboardAwareContainer(
    {
      children,
      style,
      contentContainerStyle,
      extraScrollHeight = 60,
      keyboardDismissMode = 'none',
      keyboardShouldPersistTaps = 'handled',
      ...rest
    },
    ref
  ) {
    const { colors } = useTheme();

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[{ flex: 1, backgroundColor: colors.background }, style]}
      >
        <ScrollView
          ref={ref}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          bounces={true}
          {...rest}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
);

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});

