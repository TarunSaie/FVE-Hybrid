import React, { forwardRef } from 'react';
import {
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardAwareScrollViewProps } from 'react-native-keyboard-aware-scroll-view';

export interface FVEKeyboardAwareContainerProps extends KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraScrollHeight?: number;
}

export const FVEKeyboardAwareContainer = forwardRef<KeyboardAwareScrollView, FVEKeyboardAwareContainerProps>(
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
      <KeyboardAwareScrollView
        ref={ref}
        style={[styles.container, style]}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={true}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 24 : extraScrollHeight}
        keyboardOpeningTime={0}
        enableResetScrollToCoords={false}
        {...rest}
      >
        {children}
      </KeyboardAwareScrollView>
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
