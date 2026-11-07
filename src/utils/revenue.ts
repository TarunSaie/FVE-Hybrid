import { supabase } from '@/api/supabase';

export interface RevenueBreakdown {
  membershipRevenue: number;
  dailyPassRevenue: number;
  totalRevenue: number;
  membershipTransactions: number;
  dailyPassTransactions: number;
}

export function getISTDateStr(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getISTMonthStr(date: Date = new Date()): string {
  return getISTDateStr(date).slice(0, 7);
}

export function getMonthDateRange(monthStr: string): { startDate: string; endDate: string } {
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${monthStr}-01`,
    endDate: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Add calendar days to a YYYY-MM-DD value without converting it through local time. */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Add calendar months to a YYYY-MM value without relying on the host timezone. */
export function addMonthsToMonthStr(monthStr: string, months: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatISTDateLabel(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    ...options,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Returns collected revenue for an inclusive local-date range.
 * Membership transactions use `payments.payment_date`; daily passes use
 * `daily_passes.pass_date` and only PAID records count as revenue.
 */
export async function getRevenueBreakdownForDateRange(
  startDate: string,
  endDate: string
): Promise<RevenueBreakdown> {
  const [paymentsResult, dailyPassesResult] = await Promise.all([
    supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate),
    supabase
      .from('daily_passes')
      .select('amount')
      .eq('payment_status', 'PAID')
      .gte('pass_date', startDate)
      .lte('pass_date', endDate),
  ]);

  if (paymentsResult.error) throw paymentsResult.error;
  if (dailyPassesResult.error) throw dailyPassesResult.error;

  const membershipRevenue = (paymentsResult.data || []).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
  const dailyPassRevenue = (dailyPassesResult.data || []).reduce(
    (sum, pass) => sum + Number(pass.amount || 0),
    0
  );

  return {
    membershipRevenue,
    dailyPassRevenue,
    totalRevenue: membershipRevenue + dailyPassRevenue,
    membershipTransactions: paymentsResult.data?.length || 0,
    dailyPassTransactions: dailyPassesResult.data?.length || 0,
  };
}

/** Backward-compatible total helper for existing revenue call sites. */
export async function getRevenueForDateRange(startDate: string, endDate: string): Promise<number> {
  const breakdown = await getRevenueBreakdownForDateRange(startDate, endDate);
  return breakdown.totalRevenue;
}
