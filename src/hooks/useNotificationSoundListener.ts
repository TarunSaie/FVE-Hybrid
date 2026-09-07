import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sounds } from '@/utils/sounds';
import { haptics } from '@/utils/haptics';

/**
 * Global hook to listen for real-time incoming notifications
 * and play audio & haptic alerts across the mobile application.
 */
export function useNotificationSoundListener() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const lastSoundTimestampRef = useRef<number>(0);
  const prevCountRef = useRef<number | null>(null);

  const playNotificationAlert = () => {
    const now = Date.now();
    // Throttle to avoid audio overlap if multiple notifications arrive simultaneously
    if (now - lastSoundTimestampRef.current > 1500) {
      lastSoundTimestampRef.current = now;
      sounds.notification();
      haptics.notification();
    }
  };

  // 1. Listen for real-time Postgres INSERT events on notifications table
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `mobile-notifications-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newRow = payload.new as { user_id?: string | null };
          // Play sound if notification is for this user or broadcast to all (null user_id)
          if (!newRow.user_id || newRow.user_id === user.id) {
            playNotificationAlert();
            qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
            qc.invalidateQueries({ queryKey: ['mobile-notifications'] });
            qc.invalidateQueries({ queryKey: ['unread-notifications'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  // 2. Fallback: track unread count polling to catch notifications if realtime disconnected
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-notifications-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .or(`user_id.eq.${user.id},user_id.is.null`);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (unreadCount === undefined || unreadCount === null) return;

    // Initialize baseline on first fetch without playing sound
    if (prevCountRef.current === null) {
      prevCountRef.current = unreadCount;
      return;
    }

    // Play sound only when unread count genuinely increases
    if (unreadCount > prevCountRef.current) {
      playNotificationAlert();
    }

    prevCountRef.current = unreadCount;
  }, [unreadCount]);
}
