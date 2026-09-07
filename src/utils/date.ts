/**
 * Returns a date object converted to local calendar date YYYY-MM-DD.
 * Safe for Indian Standard Time (IST) and avoids UTC off-by-one shifts.
 */
export function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns current month formatted as YYYY-MM.
 */
export function getLocalMonthStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format date string into human-friendly format (e.g. 15 Jul 2026).
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const [y, m, d] = dateStr.split('T')[0].split('-');
    if (y && m && d) {
      const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return dt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? dateStr : parsed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format datetime into short readable string (e.g. 15 Jul 2026, 06:30 PM).
 */
export function formatDateTime(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return 'N/A';
  try {
    const dt = new Date(dateTimeStr);
    if (isNaN(dt.getTime())) return dateTimeStr;
    return dt.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateTimeStr;
  }
}

/**
 * Calculates member age based on date_of_birth string.
 */
export function calculateAge(dob?: string | null): number | null {
  if (!dob) return null;
  try {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

/**
 * Timezone-safe calculation of expiry date string (YYYY-MM-DD) from a local start date string (YYYY-MM-DD)
 * and duration in days using inclusive date math (Option A).
 *
 * Expiry Date = Start Date + (durationDays - 1) days.
 * E.g. A 1-month (30-day) membership starting Sept 7 expires on Oct 6 at 23:59:59 (30 full days: Sept 7 to Oct 6 inclusive).
 * Day 1 is counted on the start date itself.
 */
export function calculateExpiryDate(startDateStr: string, durationDays: number): string {
  if (!startDateStr) return getLocalDateStr();
  const daysToAdd = Math.max(0, durationDays - 1);
  const cleanStr = startDateStr.split('T')[0];
  const parts = cleanStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const d = new Date(parts[0], parts[1] - 1, parts[2] + daysToAdd);
    return getLocalDateStr(d);
  }
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + daysToAdd);
  return getLocalDateStr(d);
}

