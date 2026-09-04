import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalDateStr } from '@/utils/date';

/**
 * Reconciles memberships where start_date was mistakenly recorded as payment date
 * instead of member joining date.
 */
export function useMembershipSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!user || hasRunRef.current) return;
    if (!['OWNER', 'ADMIN', 'RECEPTIONIST'].includes(user.role)) return;

    hasRunRef.current = true;

    const reconcile = async () => {
      try {
        const { data: memberships, error } = await supabase
          .from('memberships')
          .select('id, member_id, start_date, expiry_date, status, plan_id, created_at, members(joining_date), membership_plans(duration_days)')
          .in('status', ['ACTIVE', 'EXPIRING_SOON']);

        if (error || !memberships || memberships.length === 0) return;

        let anyUpdated = false;

        for (const ms of memberships) {
          const joiningDate = (ms.members as { joining_date?: string } | null)?.joining_date;
          const durationDays = (ms.membership_plans as { duration_days?: number } | null)?.duration_days;

          if (!joiningDate || !durationDays) continue;

          if (ms.start_date > joiningDate) {
            const { count } = await supabase
              .from('memberships')
              .select('id', { count: 'exact', head: true })
              .eq('member_id', ms.member_id)
              .lt('created_at', ms.created_at);

            if (!count || count === 0) {
              const dt = new Date(joiningDate);
              dt.setDate(dt.getDate() + durationDays);
              const expectedExpiry = getLocalDateStr(dt);

              const today = getLocalDateStr();
              let newStatus = 'ACTIVE';
              if (expectedExpiry < today) {
                newStatus = 'EXPIRED';
              }

              const { error: updateErr } = await supabase
                .from('memberships')
                .update({
                  start_date: joiningDate,
                  expiry_date: expectedExpiry,
                  status: newStatus,
                })
                .eq('id', ms.id);

              if (!updateErr) anyUpdated = true;
            }
          }
        }

        if (anyUpdated) {
          qc.invalidateQueries({ queryKey: ['mobile-members'] });
          qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
        }
      } catch (err) {
        console.error('[useMembershipSync] Error:', err);
      }
    };

    reconcile();
  }, [user, qc]);
}
