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

/**
 * Returns the date string (YYYY-MM-DD) for the day immediately following the given date string.
 * Uses local calendar arithmetic to avoid timezone shifts.
 */
export function getNextDayStr(dateStr?: string | null): string {
  if (!dateStr) return getLocalDateStr();
  const cleanStr = dateStr.split('T')[0];
  const parts = cleanStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    return getLocalDateStr(d);
  }
  const d = new Date(cleanStr);
  d.setDate(d.getDate() + 1);
  return getLocalDateStr(d);
}

/**
 * Finds the latest unexpired expiry date across active and upcoming memberships.
 * This guarantees proper consecutive chaining when a member has multiple future memberships.
 */
export function findLatestUnexpiredMembershipExpiry(
  memberships?: Array<{ status?: string | null; expiry_date?: string | null }> | null
): string | null {
  if (!memberships || memberships.length === 0) return null;
  const today = getLocalDateStr();
  const unexpired = memberships.filter((m) => {
    if (!m.expiry_date) return false;
    const cleanExp = m.expiry_date.split('T')[0];
    if (cleanExp < today) return false;
    return m.status === 'ACTIVE' || m.status === 'EXPIRING_SOON' || m.status === 'UPCOMING';
  });
  if (unexpired.length === 0) return null;
  unexpired.sort((a, b) => (b.expiry_date!.split('T')[0]).localeCompare(a.expiry_date!.split('T')[0]));
  return unexpired[0].expiry_date!.split('T')[0];
}

/**
 * Calculates the appropriate start date for a membership (new or renewal).
 * - When renewing before current membership expires (or chaining after an upcoming membership),
 *   the renewal starts on the day after the latest unexpired expiry date (consecutive, 0 days lost).
 * - For a brand new member with no prior memberships, defaults to joining date (if available).
 * - Otherwise (already expired or no history), defaults to today.
 */
export function calculateRenewalStartDate(
  latestExpiryDate?: string | null,
  joiningDate?: string | null,
  hasAnyMembership: boolean = false
): string {
  const today = getLocalDateStr();
  if (latestExpiryDate) {
    const cleanExpiry = latestExpiryDate.split('T')[0];
    if (cleanExpiry >= today) {
      return getNextDayStr(cleanExpiry);
    }
  }
  if (!hasAnyMembership && joiningDate) {
    return joiningDate.split('T')[0];
  }
  return today;
}

/**
 * Normalizes membership status against today's date (local IST).
 * Guarantees that past expiry dates are always computed as EXPIRED
 * regardless of static DB values, and respects HOLD and UPCOMING statuses.
 */
export function normalizeMembershipStatus(
  status: string | null | undefined,
  expiryDate: string | null | undefined,
  startDate?: string | null | undefined,
): 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'HOLD' | 'UPCOMING' | null {
  if (status === 'HOLD') return 'HOLD';
  const todayStr = getLocalDateStr();

  if (startDate) {
    const cleanStart = startDate.split('T')[0];
    if (cleanStart > todayStr) return 'UPCOMING';
  } else if (status === 'UPCOMING') {
    if (expiryDate && expiryDate.split('T')[0] < todayStr) return 'EXPIRED';
    return 'UPCOMING';
  }

  if (!expiryDate) {
    if (status === 'ACTIVE' || status === 'EXPIRING_SOON') return 'ACTIVE';
    return status === 'EXPIRED' ? 'EXPIRED' : null;
  }

  const cleanExp = expiryDate.split('T')[0];
  if (cleanExp < todayStr) return 'EXPIRED';

  const diffMs = new Date(cleanExp).getTime() - new Date(todayStr).getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

/**
 * Formats time string or ISO timestamp into clean 12-hour IST format (e.g. 07:13 PM).
 */
export function formatTime(timeStr?: string | null): string {
  if (!timeStr) return 'Recorded';
  try {
    // 1. If ISO timestamp with date (e.g. 2026-09-10T13:43:30.395+00:00)
    if (timeStr.includes('T') || timeStr.includes('-')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        });
      }
    }
    // 2. If already time-only string (e.g. 13:43:30 or 13:43)
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hour = parseInt(parts[0], 10);
      const minute = parts[1] ? parts[1].slice(0, 2) : '00';
      if (!isNaN(hour)) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${String(formattedHour).padStart(2, '0')}:${minute} ${ampm}`;
      }
    }
    return timeStr;
  } catch {
    return timeStr;
  }
}

/**
 * Calculates the inclusive duration in calendar days between two YYYY-MM-DD date strings.
 * Both the start date and the end date are counted (e.g. Sept 8 to Oct 7 = 30 days).
 */
export function calculateMembershipDurationDays(
  startDate?: string | null,
  endDate?: string | null
): number {
  if (!startDate || !endDate) return 0;
  const cleanStart = startDate.split('T')[0];
  const cleanEnd = endDate.split('T')[0];
  const startParts = cleanStart.split('-').map(Number);
  const endParts = cleanEnd.split('-').map(Number);
  if (
    startParts.length === 3 &&
    endParts.length === 3 &&
    !isNaN(startParts[0]) &&
    !isNaN(endParts[0])
  ) {
    const dStart = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const dEnd = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    const diffMs = dEnd.getTime() - dStart.getTime();
    if (diffMs < 0) return 0;
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }
  const dStart = new Date(startDate);
  const dEnd = new Date(endDate);
  const diffMs = dEnd.getTime() - dStart.getTime();
  if (diffMs < 0) return 0;
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}


