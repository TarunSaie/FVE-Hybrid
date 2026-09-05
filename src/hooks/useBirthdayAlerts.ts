import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalDateStr } from '@/utils/date';

const LAST_CHECK_KEY = '@fve_last_birthday_check';

/**
 * Checks all members whose birthday falls on the current date
 * and creates a BIRTHDAY notification for all Admins and Owners if not already sent today.
 */
export async function checkAndNotifyBirthdays(): Promise<number> {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // 1. Fetch all members who have a date_of_birth set
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('id, member_id, full_name, date_of_birth')
      .not('date_of_birth', 'is', null);

    if (membersErr || !members || members.length === 0) {
      return 0;
    }

    // 2. Filter members whose birthday matches today (regardless of birth year)
    const birthdayMembers = members.filter(m => {
      if (!m.date_of_birth) return false;
      const parts = m.date_of_birth.split('-');
      if (parts.length < 3) return false;
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return month === currentMonth && day === currentDay;
    });

    if (birthdayMembers.length === 0) {
      return 0;
    }

    // 3. Fetch all Admins and Owners who should receive notifications
    const { data: admins, error: adminsErr } = await supabase
      .from('user_profiles')
      .select('id, role')
      .in('role', ['OWNER', 'ADMIN']);

    if (adminsErr || !admins || admins.length === 0) {
      return 0;
    }

    // 4. Fetch notifications created today to prevent duplicate birthday alerts
    const todayStr = getLocalDateStr();
    const todayStart = `${todayStr}T00:00:00`;
    const { data: existingNotifs, error: notifErr } = await supabase
      .from('notifications')
      .select('id, user_id, message')
      .eq('type', 'BIRTHDAY')
      .gte('created_at', todayStart);

    if (notifErr) {
      console.warn('[BirthdayAlerts] Error fetching existing notifications:', notifErr.message);
    }

    const existingKeySet = new Set<string>();
    (existingNotifs || []).forEach(n => {
      existingKeySet.add(`${n.user_id}|${n.message}`);
    });

    // 5. Build notifications to insert
    const newNotifications: {
      user_id: string;
      title: string;
      message: string;
      type: string;
      read: boolean;
    }[] = [];

    for (const member of birthdayMembers) {
      const memberDisplayId = member.member_id || member.id.substring(0, 8);
      const title = '🎂 Happy Birthday!';
      const message = `Happy Birthday to ${member.full_name} (ID: ${memberDisplayId})! Today is their birthday.`;

      for (const admin of admins) {
        const dedupeKey = `${admin.id}|${message}`;
        if (!existingKeySet.has(dedupeKey)) {
          existingKeySet.add(dedupeKey);
          newNotifications.push({
            user_id: admin.id,
            title,
            message,
            type: 'BIRTHDAY',
            read: false,
          });
        }
      }
    }

    if (newNotifications.length === 0) {
      return 0;
    }

    const { error: insertErr } = await supabase
      .from('notifications')
      .insert(newNotifications);

    if (insertErr) {
      console.error('[BirthdayAlerts] Failed to insert notifications:', insertErr.message);
      return 0;
    }

    return newNotifications.length;
  } catch (err) {
    console.error('[BirthdayAlerts] Error running check:', err);
    return 0;
  }
}

/**
 * React hook that triggers birthday checks once daily on app launch / dashboard visit for Admin & Owner users.
 */
export function useBirthdayAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const runCheck = useCallback(async () => {
    if (!user) return;
    const role = user.role?.toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') return;

    const todayStr = getLocalDateStr();
    const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);

    if (lastCheck === todayStr) {
      // Already verified today on this device
      return;
    }

    const insertedCount = await checkAndNotifyBirthdays();
    await AsyncStorage.setItem(LAST_CHECK_KEY, todayStr);

    if (insertedCount > 0) {
      qc.invalidateQueries({ queryKey: ['mobile-notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
    }
  }, [user, qc]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);
}
