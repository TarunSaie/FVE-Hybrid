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
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, style]}
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
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    flexGrow: 1,
  },
});
