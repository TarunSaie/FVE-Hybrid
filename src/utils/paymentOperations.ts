import { supabase } from '@/api/supabase';
import { calculateExpiryDate, getLocalDateStr, normalizeMembershipStatus } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import { MembershipPlan, Payment } from '@/types';

export interface RevertPaymentParams {
  paymentId: string;
  memberId?: string;
  receiptNumber?: string | null;
  amount?: string | number;
  memberName?: string;
  performedByUserId?: string | null;
}

export interface RevertPaymentResult {
  success: boolean;
  message?: string;
  error?: string;
  planReverted?: boolean;
  revertedPlanName?: string;
}

/**
 * Reverts or deletes a payment record cleanly across the entire mobile application:
 * 1. Checks if the payment was collected for a Plan Upgrade/Change:
 *    - Restores the membership back to its original plan and validity.
 *    - Marks the plan_change_requests record as CANCELLED.
 * 2. Checks if the payment is linked to a Personal Training record:
 *    - Unlinks the payment and marks PT status as PENDING_PAYMENT.
 * 3. Deletes the payment record from the `payments` table.
 * 4. Logs an audit notification for gym administrative tracking.
 */
export async function revertOrDeletePayment(
  input: Payment | RevertPaymentParams
): Promise<RevertPaymentResult> {
  const paymentId = 'id' in input ? input.id : input.paymentId;
  const receiptNumber = 'receipt_number' in input ? input.receipt_number : input.receiptNumber;
  const amount = 'amount' in input ? input.amount : input.amount;
  const memberName =
    'members' in input && input.members ? input.members.full_name : 'memberName' in input ? input.memberName : undefined;

  if (!paymentId) {
    return { success: false, error: 'Payment ID is required to revert or delete payment' };
  }

  // 1. Fetch full payment record if not completely known
  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('*, members(id, full_name), memberships(*, membership_plans(*))')
    .eq('id', paymentId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to retrieve payment: ${fetchErr.message}`);
  }

  if (!payment) {
    throw new Error('Payment not found. It may have already been removed.');
  }

  const resolvedMemberName = memberName || payment.members?.full_name || 'Member';
  const resolvedReceiptNo = receiptNumber || payment.receipt_number || 'N/A';
  const resolvedAmount = amount != null ? amount : payment.amount;

  let planReverted = false;
  let revertedPlanName: string | undefined;

  // 2. Check if this payment is linked to a plan_change_requests record
  const { data: linkedPlanChange } = await supabase
    .from('plan_change_requests')
    .select('*, current_plan:membership_plans!current_plan_id(*), requested_plan:membership_plans!requested_plan_id(*)')
    .eq('payment_id', paymentId)
    .maybeSingle();

  let targetPlanChange = linkedPlanChange;

  // Fallback: If not linked directly by payment_id, check if membership has a COMPLETED upgrade
  if (!targetPlanChange && payment.membership_id && payment.notes?.includes('Plan Upgrade:')) {
    const { data: recentPlanChange } = await supabase
      .from('plan_change_requests')
      .select('*, current_plan:membership_plans!current_plan_id(*), requested_plan:membership_plans!requested_plan_id(*)')
      .eq('membership_id', payment.membership_id)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPlanChange) {
      targetPlanChange = recentPlanChange;
    }
  }

  // If a plan upgrade is associated with this payment, revert the membership plan
  if (targetPlanChange && targetPlanChange.current_plan && payment.membership_id) {
    const originalPlan = targetPlanChange.current_plan as unknown as MembershipPlan;
    const membership = payment.memberships;

    if (membership && originalPlan) {
      const restoredExpiry = calculateExpiryDate(membership.start_date, originalPlan.duration_days);
      const restoredStatus = normalizeMembershipStatus('ACTIVE', restoredExpiry) || 'ACTIVE';

      const { error: msUpdateErr } = await supabase
        .from('memberships')
        .update({
          plan_id: originalPlan.id,
          expiry_date: restoredExpiry,
          status: restoredStatus,
          visit_day_limit: originalPlan.visit_day_limit ?? null,
        })
        .eq('id', payment.membership_id);

      if (msUpdateErr) {
        console.warn('[revertOrDeletePayment] Warning reverting membership plan:', msUpdateErr.message);
      } else {
        planReverted = true;
        revertedPlanName = originalPlan.name;
      }
    }

    // Update plan_change_requests row to CANCELLED
    await supabase
      .from('plan_change_requests')
      .update({
        status: 'CANCELLED',
        notes: (targetPlanChange.notes || '') + ` [Upgrade reverted and payment deleted on ${getLocalDateStr()}]`,
        payment_id: null,
      })
      .eq('id', targetPlanChange.id);
  }

  // 2b. If NO plan upgrade was involved but the payment has a linked membership,
  //     keep membership status in sync with the payment deletion.
  //     Scenario A: Only payment for this membership → EXPIRE the membership.
  //     Scenario B: Other payments remain (renewal chain) → restore previous dates.
  if (!planReverted && payment.membership_id) {
    const { data: remainingPayments } = await supabase
      .from('payments')
      .select('id, created_at, memberships(start_date, expiry_date, plan_id, membership_plans(duration_days, visit_day_limit))')
      .eq('membership_id', payment.membership_id)
      .neq('id', paymentId)
      .order('created_at', { ascending: false });

    if (!remainingPayments || remainingPayments.length === 0) {
      await supabase
        .from('memberships')
        .update({
          status: 'EXPIRED',
          notes: `[Payment #${resolvedReceiptNo} deleted on ${getLocalDateStr()} — membership deactivated, no valid payment remains]`,
        })
        .eq('id', payment.membership_id);
    } else {
      const prevPayment = remainingPayments[0] as typeof remainingPayments[0] & {
        memberships?: {
          start_date?: string;
          expiry_date?: string;
          plan_id?: string;
          membership_plans?: { duration_days?: number; visit_day_limit?: number | null };
        };
      };
      const prevMembership = prevPayment?.memberships;
      if (prevMembership?.start_date && prevMembership?.membership_plans?.duration_days) {
        const restoredExpiry = calculateExpiryDate(
          prevMembership.start_date,
          prevMembership.membership_plans.duration_days
        );
        const restoredStatus = normalizeMembershipStatus('ACTIVE', restoredExpiry) || 'ACTIVE';
        await supabase
          .from('memberships')
          .update({
            expiry_date: restoredExpiry,
            status: restoredStatus,
            plan_id: prevMembership.plan_id ?? undefined,
            visit_day_limit: prevMembership.membership_plans.visit_day_limit ?? null,
            notes: `[Payment #${resolvedReceiptNo} deleted on ${getLocalDateStr()} — dates restored to previous payment]`,
          })
          .eq('id', payment.membership_id);
      }
    }
  }

  // 3. Check and unlink from Personal Training if applicable
  const { data: linkedPT } = await supabase
    .from('personal_training')
    .select('id, package_name')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (linkedPT) {
    await supabase
      .from('personal_training')
      .update({
        payment_id: null,
        status: 'PENDING_PAYMENT',
      })
      .eq('id', linkedPT.id);
  }

  // 4. Delete the payment record
  const { error: deleteErr } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (deleteErr) {
    throw new Error(`Failed to delete payment transaction: ${deleteErr.message}`);
  }

  // 5. Create an administrative audit notification
  try {
    const detailMsg = planReverted
      ? ` Receipt #${resolvedReceiptNo} (${formatCurrency(resolvedAmount)}) for ${resolvedMemberName} was reverted. Plan restored to ${revertedPlanName}.`
      : ` Receipt #${resolvedReceiptNo} (${formatCurrency(resolvedAmount)}) for ${resolvedMemberName} was deleted from financial records.`;

    await supabase.from('notifications').insert({
      title: 'Payment Reverted / Deleted',
      message: detailMsg,
      type: 'SYSTEM',
    });
  } catch (notifyErr) {
    console.warn('[revertOrDeletePayment] Non-critical notification error:', notifyErr);
  }

  return {
    success: true,
    message: planReverted
      ? `Payment deleted and membership plan reverted to ${revertedPlanName}`
      : `Payment #${resolvedReceiptNo} successfully deleted`,
    planReverted,
    revertedPlanName,
  };
}
