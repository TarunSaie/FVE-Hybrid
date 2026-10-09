import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StyleProp,
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets, Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export interface ScreenContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  edges?: Edge[];
  paddingHorizontal?: boolean;
}

export function ScreenContainer({
  children,
  header,
  scrollable = false,
  refreshControl,
  style,
  contentContainerStyle,
  keyboardAvoiding = Platform.OS === 'ios',
  edges = [],
  paddingHorizontal = false,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const insetPadding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
  };

  const innerContent = scrollable ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[
        paddingHorizontal && styles.horizontalPadding,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.fill,
        paddingHorizontal && styles.horizontalPadding,
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const wrappedContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fill}
    >
      {innerContent}
    </KeyboardAvoidingView>
  ) : (
    innerContent
  );

  return (
    <View style={[containerStyle, insetPadding, style]}>
      {header}
      {wrappedContent}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  horizontalPadding: {
    paddingHorizontal: 16,
  },
});
