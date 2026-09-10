import { Linking, Alert } from 'react-native';
import { colors } from '@/constants/colors';
import { formatDate } from './date';

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

/**
 * Builds standard WhatsApp renewal alert message for expired members.
 */
export function buildExpiredAlertMessage(
  memberName: string,
  planName?: string | null,
  expiryDate?: string | null
): string {
  const planInfo = planName ? ` (${planName})` : '';
  const dateInfo = expiryDate ? ` on *${formatDate(expiryDate)}*` : '';
  return (
    `Hi *${memberName}*,\n\n` +
    `Your *FitVerse Elite* gym membership${planInfo} has expired${dateInfo}.\n\n` +
    `Please renew your membership to continue your workouts uninterrupted.\n\n` +
    `Visit our front desk or contact us for quick renewal assistance.\n\n` +
    `— Team FitVerse Elite`
  );
}

/**
 * Safely parse features stored as JSON string, string array, or comma-separated string.
 */
export function parseFeatures(features: unknown): string[] {
  if (Array.isArray(features)) return features.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
    } catch {
      // Fall back to comma-separated or single string
    }
    return features.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Normalizes a membership plan with parsed features array and numeric price.
 */
export function normalizeMembershipPlan<T extends { price: unknown; features?: unknown }>(plan: T) {
  return {
    ...plan,
    price: Number(plan.price) || 0,
    features: parseFeatures(plan.features),
  };
}

/**
 * Translates database and technical exceptions into clear, human-understandable messages.
 */
export function getFriendlyErrorMessage(
  err: unknown,
  fallbackMessage = 'Unable to complete the action. Please try again.'
): string {
  if (!err) return fallbackMessage;
  const msg = (err as Error)?.message || String(err);

  if (msg.includes('transaction_reference') && msg.includes('not-null')) {
    return 'Transaction reference is missing. If paying with UPI, Card, or Bank Transfer, please enter the reference ID.';
  }
  if (msg.includes('violates not-null constraint')) {
    return 'A required field was left blank. Please check all details and try again.';
  }
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    return 'This record already exists or was already recorded.';
  }
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
    return 'Network connection error. Please check your internet connection.';
  }
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth')) {
    return 'Your session has expired. Please log in again.';
  }

  return msg;
}

