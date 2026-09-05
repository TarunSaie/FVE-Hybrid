import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalDateStr, formatDate } from '@/utils/date';

/**
 * Checks for memberships expiring in <= 7 days once per session day
 * and inserts in-app notifications for OWNER/ADMIN/RECEPTIONIST users.
 * Also transitions expired memberships to HOLD status.
 */
export function useRenewalAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const checkRenewal = async () => {
      try {
        const today = getLocalDateStr();
        const lastRun = await AsyncStorage.getItem('renewal-alert-run');
        if (lastRun === today) return;

        await AsyncStorage.setItem('renewal-alert-run', today);

        // 1. Find memberships expiring in 0-7 days
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const { data: expiring } = await supabase
          .from('memberships')
          .select('*, members(full_name), membership_plans(name)')
          .eq('status', 'ACTIVE')
          .lte('expiry_date', getLocalDateStr(sevenDaysLater))
          .gte('expiry_date', today);

        // 2. Notifications: only OWNER/ADMIN create them
        if (expiring && expiring.length > 0 && ['OWNER', 'ADMIN'].includes(user.role)) {
          const { data: staffList } = await supabase
            .from('user_profiles')
            .select('id, role')
            .in('role', ['OWNER', 'ADMIN', 'RECEPTIONIST']);

          if (staffList && staffList.length > 0) {
            const { data: todaysNotifications } = await supabase
              .from('notifications')
              .select('user_id, message')
              .in('user_id', staffList.map(s => s.id))
              .gte('created_at', `${today}T00:00:00`);

            const existingKeys = new Set(
              (todaysNotifications || []).map(n => `${n.user_id}|${n.message}`)
            );

            const notifications = [];
            for (const ms of expiring) {
              const memberName = (ms.members as { full_name?: string } | null)?.full_name || 'Member';
              const planName = (ms.membership_plans as { name?: string } | null)?.name || 'Plan';
              const expiryDate = formatDate(ms.expiry_date);
              const daysLeft = Math.ceil(
                (new Date(ms.expiry_date).getTime() - new Date(today).getTime()) / 86400000
              );

              for (const staff of staffList) {
                const message = `${memberName}'s ${planName} expires on ${expiryDate} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left). Renew now to retain member.`;
                const key = `${staff.id}|${message}`;
                if (existingKeys.has(key)) continue;

                notifications.push({
                  user_id: staff.id,
                  title: '⚠️ Membership Expiring Soon',
                  message,
                  type: 'WARNING',
                });
              }
            }

            if (notifications.length > 0) {
              await supabase.from('notifications').insert(notifications);
              qc.invalidateQueries({ queryKey: ['mobile-notifications'] });
              qc.invalidateQueries({ queryKey: ['unread-notifications'] });
              qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
            }
          }
        }

        // 3. Auto-transition expired memberships to HOLD status
        const { data: expired } = await supabase
          .from('memberships')
          .select('id')
          .eq('status', 'ACTIVE')
          .lt('expiry_date', today);

        if (expired && expired.length > 0) {
          await supabase
            .from('memberships')
            .update({ status: 'HOLD' })
            .in('id', expired.map(e => e.id));
          qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
          qc.invalidateQueries({ queryKey: ['mobile-members'] });
        }
      } catch (err) {
        console.error('[useRenewalAlerts] Error:', err);
      }
    };

    checkRenewal();
  }, [user, qc]);
}
