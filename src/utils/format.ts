import { Linking, Alert } from 'react-native';
import { colors } from '@/constants/colors';
import { formatDate } from './date';
import type { DietPlan, DietMeal, DayOfWeek } from '@/types';
import { DAYS_OF_WEEK } from '@/types';

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

/**
 * Builds professional WhatsApp congratulatory and receipt message for membership plan upgrade.
 */
export function buildPlanUpgradeWhatsAppMessage(
  memberName: string,
  oldPlanName: string,
  newPlanName: string,
  balanceAmount: number | string,
  newExpiryDate: string,
  receiptNumber?: string | null
): string {
  const receiptLine = receiptNumber ? `• Receipt No: *${receiptNumber}*\n` : '';
  return (
    `Hi *${memberName}*,\n\n` +
    `Your membership at *FitVerse Elite* has been successfully upgraded!\n\n` +
    `• Previous Plan: *${oldPlanName}*\n` +
    `• Upgraded Plan: *${newPlanName}*\n` +
    `• Balance Paid: *${formatCurrency(Number(balanceAmount))}*\n` +
    `• New Validity Until: *${formatDate(newExpiryDate)}*\n` +
    receiptLine +
    `\nThank you for committing to your fitness journey with us. Enjoy your training!\n\n` +
    `— Team FitVerse Elite`
  );
}

/**
 * Resolves current day of the week in Indian Standard Time (IST / Asia/Kolkata).
 */
export function getTodayDayOfWeek(): DayOfWeek {
  const dayNames: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const istDayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
  return (dayNames.find(d => d.toLowerCase() === istDayStr.toLowerCase()) || 'Monday') as DayOfWeek;
}

/**
 * Builds professional WhatsApp message with daily meal schedule and target nutrition for Personal Training members.
 */
export function buildDailyDietPlanWhatsAppMessage(
  memberName: string,
  dietPlan: DietPlan,
  trainerName?: string | null,
  targetDay?: DayOfWeek | string | null
): string {
  const todayDay = getTodayDayOfWeek();
  const effectiveDay: DayOfWeek = (targetDay && DAYS_OF_WEEK.includes(targetDay as DayOfWeek))
    ? (targetDay as DayOfWeek)
    : todayDay;

  // Resolve meals for target day
  let mealsToRender: DietMeal[] = [];
  const schedule = dietPlan.weekly_schedule;
  const isWeeklySchedule = Boolean(schedule && Object.keys(schedule).length > 0 && DAYS_OF_WEEK.some(d => schedule[d]?.length));

  if (isWeeklySchedule && schedule && schedule[effectiveDay] && schedule[effectiveDay]!.length > 0) {
    mealsToRender = schedule[effectiveDay]!;
  } else if (Array.isArray(dietPlan.meals) && dietPlan.meals.length > 0) {
    mealsToRender = dietPlan.meals;
  }

  const goalLine = dietPlan.goal ? `🎯 *Goal:* ${dietPlan.goal}\n` : '';
  const trainerLine = trainerName ? `🏋️ *Coach / Trainer:* ${trainerName}\n` : '';
  const dayLine = isWeeklySchedule
    ? `📅 *Day:* *${effectiveDay}* ${effectiveDay === todayDay ? '(Today)' : ''}\n`
    : '';

  let nutritionSection = '';
  const macros: string[] = [];
  if (dietPlan.protein_grams) macros.push(`Protein: ${dietPlan.protein_grams}g`);
  if (dietPlan.carbs_grams) macros.push(`Carbs: ${dietPlan.carbs_grams}g`);
  if (dietPlan.fats_grams) macros.push(`Fats: ${dietPlan.fats_grams}g`);

  if (dietPlan.daily_calories || macros.length > 0 || dietPlan.water_liters) {
    nutritionSection = `📊 *Target Daily Nutrition:*\n`;
    if (dietPlan.daily_calories) nutritionSection += `• *Calories:* ~${dietPlan.daily_calories} kcal\n`;
    if (macros.length > 0) nutritionSection += `• *Macros:* ${macros.join(' | ')}\n`;
    if (dietPlan.water_liters) nutritionSection += `• *Hydration:* ${dietPlan.water_liters} Litres / day 💧\n`;
    nutritionSection += '\n';
  }

  let mealsSection = '';
  if (mealsToRender.length > 0) {
    mealsSection = isWeeklySchedule
      ? `🍽️ *${effectiveDay}'s Meal Schedule:*\n`
      : `🍽️ *Daily Meal Schedule:*\n`;
    mealsToRender.forEach((meal, idx) => {
      const timeStr = meal.time ? ` (${meal.time})` : '';
      mealsSection += `*${idx + 1}. ${meal.name}${timeStr}*\n${meal.items}\n\n`;
    });
  }

  let supplementsSection = '';
  if (dietPlan.supplements && dietPlan.supplements.trim()) {
    supplementsSection = `💊 *Supplements:*\n${dietPlan.supplements.trim()}\n\n`;
  }

  let instructionsSection = '';
  if (dietPlan.instructions && dietPlan.instructions.trim()) {
    instructionsSection = `💡 *Coach's Instructions:*\n${dietPlan.instructions.trim()}\n\n`;
  }

  return (
    `🔥 *FITVERSE ELITE — DAILY DIET PLAN* 🔥\n\n` +
    `Hi *${memberName}*,\n` +
    `Here is your customized nutrition plan designed exclusively for your Personal Training.\n\n` +
    `📋 *Plan:* *${dietPlan.title}*\n` +
    dayLine +
    goalLine +
    trainerLine +
    `\n` +
    nutritionSection +
    mealsSection +
    supplementsSection +
    instructionsSection +
    `💪 _"Consistency beats talent when talent doesn't work hard. Fuel your body right today!"_\n\n` +
    `— Team FitVerse Elite`
  );
}

/**
 * Builds full 7-day weekly schedule summary for WhatsApp sharing.
 */
export function buildWeeklyDietPlanOverviewWhatsAppMessage(
  memberName: string,
  dietPlan: DietPlan,
  trainerName?: string | null
): string {
  const goalLine = dietPlan.goal ? `🎯 *Goal:* ${dietPlan.goal}\n` : '';
  const trainerLine = trainerName ? `🏋️ *Coach / Trainer:* ${trainerName}\n` : '';
  const schedule = dietPlan.weekly_schedule;

  let scheduleSection = '';
  if (schedule) {
    DAYS_OF_WEEK.forEach(day => {
      const dayMeals = schedule[day];
      if (dayMeals && dayMeals.length > 0) {
        scheduleSection += `*═══════ ${day.toUpperCase()} ═══════*\n`;
        dayMeals.forEach((meal, idx) => {
          const timeStr = meal.time ? ` (${meal.time})` : '';
          scheduleSection += `• *${meal.name}${timeStr}:* ${meal.items}\n`;
        });
        scheduleSection += '\n';
      }
    });
  }

  if (!scheduleSection && Array.isArray(dietPlan.meals)) {
    scheduleSection += `*═══════ DAILY SCHEDULE ═══════*\n`;
    dietPlan.meals.forEach((meal) => {
      const timeStr = meal.time ? ` (${meal.time})` : '';
      scheduleSection += `• *${meal.name}${timeStr}:* ${meal.items}\n`;
    });
    scheduleSection += '\n';
  }

  let nutritionSummary = '';
  if (dietPlan.daily_calories || dietPlan.protein_grams) {
    nutritionSummary = `📊 *Daily Targets:* ~${dietPlan.daily_calories || 0} kcal | Protein: ${dietPlan.protein_grams || 0}g | Water: ${dietPlan.water_liters || 3.5}L\n\n`;
  }

  return (
    `🔥 *FITVERSE ELITE — WEEKLY DIET OVERVIEW* 🔥\n\n` +
    `Hi *${memberName}*,\n` +
    `Here is your full weekly nutrition schedule for your Personal Training program.\n\n` +
    `📋 *Plan:* *${dietPlan.title}*\n` +
    goalLine +
    trainerLine +
    `\n` +
    nutritionSummary +
    scheduleSection +
    `💪 _"Plan your work and work your plan. Stay disciplined!"_\n\n` +
    `— Team FitVerse Elite`
  );
}


