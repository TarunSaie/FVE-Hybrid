import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptics = {
  /** Light impact for subtle UI interactions (chips, segment toggles, minor buttons) */
  light: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Medium impact for primary buttons, tab switches, cards */
  medium: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Heavy impact for destructive actions (delete, reset) */
  heavy: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Success notification for completed check-ins, successful payments, QR scan capture */
  success: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Warning notification for expiring alerts, limit warnings */
  warning: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Error notification for failed operations, duplicate scans, validation errors */
  error: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Selection click for pickers, segmented controls, bottom tab changes */
  selection: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.selectionAsync();
    } catch {
      // Ignore unsupported platforms
    }
  },

  /** Standard notification alert haptic */
  notification: () => {
    if (Platform.OS === 'web') return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignore unsupported platforms
    }
  },
};
