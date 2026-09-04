import { Linking, Alert } from 'react-native';
import { colors } from '@/constants/colors';

/**
 * Format number into Indian Rupee format without decimals.
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Strips non-digits and ensures country code 91 is present.
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Opens WhatsApp on device with pre-filled text message.
 */
export async function openWhatsAppLink(phone: string, message: string): Promise<void> {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Unable to open WhatsApp', 'WhatsApp is not installed or the link cannot be handled on this device.');
    }
  } catch (error) {
    Alert.alert('WhatsApp Error', (error as Error).message || 'Failed to open WhatsApp');
  }
}

/**
 * Generates an FVE receipt number (e.g. FVE-2026-7A9X).
 */
export function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `FVE-${year}-${randomStr}`;
}

/**
 * Status style mapping for membership badges.
 */
export function getMembershipStatusStyle(status?: string | null): { bg: string; text: string; border: string; label: string } {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return {
        bg: colors.successMuted,
        text: colors.success,
        border: colors.successBorder,
        label: 'ACTIVE',
      };
    case 'EXPIRING_SOON':
      return {
        bg: colors.warningMuted,
        text: colors.warning,
        border: colors.warningBorder,
        label: 'EXPIRING SOON',
      };
    case 'EXPIRED':
      return {
        bg: colors.errorMuted,
        text: colors.error,
        border: colors.errorBorder,
        label: 'EXPIRED',
      };
    case 'HOLD':
      return {
        bg: 'rgba(156, 163, 175, 0.15)',
        text: '#9CA3AF',
        border: 'rgba(156, 163, 175, 0.35)',
        label: 'ON HOLD',
      };
    default:
      return {
        bg: colors.goldMuted,
        text: colors.gold,
        border: colors.goldBorder,
        label: status || 'NONE',
      };
  }
}
