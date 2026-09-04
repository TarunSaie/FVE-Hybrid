import { supabase } from '@/api/supabase';

export interface VisitLimited {
  id: string;
  visit_day_limit?: number | null;
  visit_days_used?: number | null;
}

export interface VisitLimitStatus {
  used: number;
  limit: number | null;
  isLimited: boolean;
  exhausted: boolean;
}

/**
 * Whether a limited-visit membership still has usable days left.
 * NULL limit indicates unlimited access based strictly on date range.
 */
export function visitLimitStatus(m: VisitLimited | null | undefined): VisitLimitStatus {
  const used = m?.visit_days_used ?? 0;
  const limit = m?.visit_day_limit ?? null;
  return {
    used,
    limit,
    isLimited: limit != null,
    exhausted: limit != null && used >= limit,
  };
}

/**
 * Consume one visit day for a limited membership and auto-expire it when the
 * last allowed day is reached.
 * Atomic UPDATE ensures safe deduplication.
 */
export async function consumeVisitDay(m: VisitLimited): Promise<boolean> {
  const { used, limit } = visitLimitStatus(m);
  const next = used + 1;

  const patch: { visit_days_used: number; status?: string } = { visit_days_used: next };
  if (limit != null && next >= limit) patch.status = 'EXPIRED';

  const { error } = await supabase
    .from('memberships')
    .update(patch)
    .eq('id', m.id);

  if (error) {
    console.error(`[visitLimit] Failed to consume visit day for membership ${m.id}:`, error.message);
    return false;
  }
  return true;
}
