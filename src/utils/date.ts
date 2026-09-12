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
 * Normalizes membership status against today's date (local IST).
 * Guarantees that past expiry dates are always computed as EXPIRED
 * regardless of static DB values, and respects HOLD status.
 */
export function normalizeMembershipStatus(
  status: string | null | undefined,
  expiryDate: string | null | undefined,
): 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'HOLD' | null {
  if (status === 'HOLD') return 'HOLD';

  if (!expiryDate) {
    if (status === 'ACTIVE' || status === 'EXPIRING_SOON') return 'ACTIVE';
    return status === 'EXPIRED' ? 'EXPIRED' : null;
  }

  const todayStr = getLocalDateStr();
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


