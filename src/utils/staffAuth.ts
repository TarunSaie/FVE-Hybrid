import { supabase, getActiveSupabaseConfig } from '@/utils/supabase';
import { UserRole } from '@/types';

export interface CreateStaffAccountParams {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
}

/**
 * Creates an authentic Supabase Auth account for a staff member via the
 * `create-staff` Edge Function, which uses the service-role key and
 * auth.admin.createUser() — bypassing the "signups disabled" restriction
 * while keeping the Owner's active session intact and the service role key
 * out of client-side code.
 */
export async function createStaffAccount(
  params: CreateStaffAccountParams
): Promise<{ success: boolean; error?: string }> {
  const { email, password, fullName, role, phone } = params;
  const config = await getActiveSupabaseConfig();

  const normalizedEmail = email.trim().toLowerCase();

  // Retrieve the current Owner's JWT to authenticate the edge function call
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'You must be signed in as Owner to create staff accounts' };
  }

  try {
    const functionUrl = `${config.url}/functions/v1/create-staff`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass the Owner's JWT — the Edge Function validates this and checks the OWNER role
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        full_name: fullName,
        role,
        phone: phone || null,
      }),
    });

    const json = await response.json();

    if (!response.ok || json.error) {
      return { success: false, error: json.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to create staff account',
    };
  }
}
