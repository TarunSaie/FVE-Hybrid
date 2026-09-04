import React, { useState, useEffect, forwardRef } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ScrollViewProps,
  Keyboard,
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
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    useEffect(() => {
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        () => setIsKeyboardVisible(true)
      );
      const hideSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => setIsKeyboardVisible(false)
      );
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    // On iOS, KeyboardAvoidingView (behavior="padding") dynamically adjusts its height.
    // On Android, softwareKeyboardLayoutMode="resize" shrinks the window.
    // Provide calibrated bottom clearance so inputs can be freely scrolled above the keyboard.
    const dynamicBottomPadding = isKeyboardVisible
      ? (Platform.OS === 'ios' ? 40 : 120)
      : extraScrollHeight;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, style]}
      >
        <ScrollView
          ref={ref}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            contentContainerStyle,
            { paddingBottom: dynamicBottomPadding },
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          bounces={true}
          alwaysBounceVertical={true}
          overScrollMode="always"
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
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
