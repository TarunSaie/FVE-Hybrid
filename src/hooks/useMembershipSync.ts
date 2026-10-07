import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalDateStr, calculateExpiryDate, normalizeMembershipStatus } from '@/utils/date';

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
        const today = getLocalDateStr();
        let anyUpdated = false;

        // 1. Activate upcoming memberships whose start_date has arrived (RPC with direct fallback)
        try {
          const { data: activated, error: rpcErr } = await supabase.rpc('activate_upcoming_memberships');
          if (!rpcErr && (Array.isArray(activated) ? activated.length > 0 : Number(activated) > 0)) {
            anyUpdated = true;
          } else if (rpcErr) {
            const { data: upcomingDue } = await supabase
              .from('memberships')
              .select('id, member_id, start_date, expiry_date')
              .eq('status', 'UPCOMING')
              .lte('start_date', today);

            if (upcomingDue && upcomingDue.length > 0) {
              for (const up of upcomingDue) {
                await supabase
                  .from('memberships')
                  .update({ status: 'EXPIRED' })
                  .eq('member_id', up.member_id)
                  .neq('id', up.id)
                  .in('status', ['ACTIVE', 'EXPIRING_SOON'])
                  .lt('expiry_date', today);

                const newStatus = normalizeMembershipStatus('ACTIVE', up.expiry_date, up.start_date) || 'ACTIVE';
                await supabase
                  .from('memberships')
                  .update({ status: newStatus })
                  .eq('id', up.id);

                anyUpdated = true;
              }
            }
          }
        } catch (rpcCatch) {
          console.warn('[useMembershipSync mobile] Activation check error:', rpcCatch);
        }

        // 2. Expire any memberships whose expiry_date has passed but remain ACTIVE/EXPIRING_SOON
        const { data: pastDueActive } = await supabase
          .from('memberships')
          .select('id')
          .in('status', ['ACTIVE', 'EXPIRING_SOON'])
          .lt('expiry_date', today);

        if (pastDueActive && pastDueActive.length > 0) {
          const pastIds = pastDueActive.map(p => p.id);
          await supabase
            .from('memberships')
            .update({ status: 'EXPIRED' })
            .in('id', pastIds);
          anyUpdated = true;
        }

        const { data: memberships, error } = await supabase
          .from('memberships')
          .select('id, member_id, start_date, expiry_date, status, plan_id, created_at, members(joining_date), membership_plans(duration_days)')
          .in('status', ['ACTIVE', 'EXPIRING_SOON']);

        if (error || !memberships || memberships.length === 0) {
          if (anyUpdated) {
            qc.invalidateQueries({ queryKey: ['mobile-members'] });
            qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
          }
          return;
        }

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
              const expectedExpiry = calculateExpiryDate(joiningDate, durationDays);

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
