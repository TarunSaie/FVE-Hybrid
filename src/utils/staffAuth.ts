import { createClient } from '@supabase/supabase-js';
import { getActiveSupabaseConfig, supabase } from '@/utils/supabase';
import { UserRole } from '@/types';

export interface CreateStaffAccountParams {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
}

/**
 * Creates an authentic Supabase Auth account for a staff member (Admin, Receptionist, Trainer)
 * using an isolated client so the gym Owner's active session is NOT interrupted on mobile.
 */
export async function createStaffAccount(
  params: CreateStaffAccountParams
): Promise<{ success: boolean; error?: string }> {
  const { email, password, fullName, role, phone } = params;
  const config = await getActiveSupabaseConfig();

  const normalizedEmail = email.trim().toLowerCase();

  // Create an isolated non-persisted client
  const isolatedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { data, error } = await isolatedClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      // Upsert the profile row linked directly to auth.users.id
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: normalizedEmail,
          username: normalizedEmail.split('@')[0],
          full_name: fullName,
          role,
          phone: phone || null,
        });

      if (profileError) {
        console.warn('Profile upsert notice:', profileError);
      }
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to create staff auth account',
    };
  }
}
