import { supabase } from '@/utils/supabase';

/**
 * Removes all notifications related to a specific member's Personal Training:
 * - PT requests ("New Personal Training Request")
 * - Trainer assignments ("Assigned as Personal Trainer")
 * - PT activations ("Personal Training Activated")
 * - PT session bookings/completions ("PT Session Scheduled", "PT Session Completed!")
 */
export async function cleanupPTNotifications(memberId?: string, memberName?: string): Promise<void> {
  try {
    let resolvedName = memberName?.trim();
    if (!resolvedName && memberId) {
      const { data } = await supabase.from('members').select('full_name').eq('id', memberId).maybeSingle();
      if (data?.full_name) resolvedName = data.full_name.trim();
    }

    if (resolvedName) {
      // Escape SQL wildcards
      const safeName = resolvedName.replace(/[%_]/g, '');
      await supabase
        .from('notifications')
        .delete()
        .or('title.ilike.%Personal Training%,title.ilike.%Personal Trainer%,title.ilike.%PT Session%')
        .ilike('message', `%${safeName}%`);
    }

    if (memberId) {
      // Remove any notification sent directly to this member's user_id regarding PT
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', memberId)
        .or('title.ilike.%Personal Training%,title.ilike.%Personal Trainer%,title.ilike.%PT Session%');
    }
  } catch (err) {
    console.warn('[cleanupPTNotifications] Error cleaning up notifications:', err);
  }
}
