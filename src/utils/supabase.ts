import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { ClientProfile, SupabaseTestResult } from '@/types/branding';

export const FVE_SUPABASE_URL_KEY = 'fve_supabase_url';
export const FVE_SUPABASE_ANON_KEY = 'fve_supabase_anon_key';
export const FVE_CLIENT_PROFILES_KEY = 'fve_client_profiles';

export const DEFAULT_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pmrxrqneaqjqjazfidtf.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_eLmMv90HOEJNF8K07yaVMg_cqk38Ltr';

export interface SupabaseConnectionConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
  defaultUrl: string;
  defaultAnonKey: string;
}

export const SUPABASE_URL = DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getActiveSupabaseConfig(): Promise<SupabaseConnectionConfig> {
  try {
    const customUrl = await AsyncStorage.getItem(FVE_SUPABASE_URL_KEY);
    const customKey = await AsyncStorage.getItem(FVE_SUPABASE_ANON_KEY);
    if (customUrl && customKey) {
      return {
        url: customUrl.trim(),
        anonKey: customKey.trim(),
        isCustom: true,
        defaultUrl: DEFAULT_SUPABASE_URL,
        defaultAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      };
    }
  } catch {
    // Fallback to default
  }

  return {
    url: DEFAULT_SUPABASE_URL,
    anonKey: DEFAULT_SUPABASE_ANON_KEY,
    isCustom: false,
    defaultUrl: DEFAULT_SUPABASE_URL,
    defaultAnonKey: DEFAULT_SUPABASE_ANON_KEY,
  };
}

export async function setCustomSupabaseConfig(
  url: string,
  anonKey: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedUrl = (url || '').trim();
  const trimmedKey = (anonKey || '').trim();

  if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
    return { success: false, error: 'Supabase URL must start with https:// or http://' };
  }

  if (!trimmedKey) {
    return { success: false, error: 'Supabase Anon / Publishable key is required' };
  }

  try {
    await AsyncStorage.setItem(FVE_SUPABASE_URL_KEY, trimmedUrl);
    await AsyncStorage.setItem(FVE_SUPABASE_ANON_KEY, trimmedKey);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error)?.message || 'Failed to save configuration' };
  }
}

export async function resetSupabaseConfig(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FVE_SUPABASE_URL_KEY);
    await AsyncStorage.removeItem(FVE_SUPABASE_ANON_KEY);
  } catch {
    // Ignore errors
  }
}

export async function getSavedClientProfiles(): Promise<ClientProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(FVE_CLIENT_PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveClientProfile(
  profile: Omit<ClientProfile, 'id' | 'createdAt'> & { id?: string }
): Promise<ClientProfile[]> {
  try {
    const profiles = await getSavedClientProfiles();
    const existingIdx = profile.id ? profiles.findIndex((p) => p.id === profile.id) : -1;

    const entry: ClientProfile = {
      id: profile.id || `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: profile.name.trim() || 'Untitled Client',
      url: profile.url.trim(),
      anonKey: profile.anonKey.trim(),
      notes: profile.notes?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    let updated: ClientProfile[];
    if (existingIdx >= 0) {
      updated = [...profiles];
      updated[existingIdx] = { ...updated[existingIdx], ...entry };
    } else {
      updated = [entry, ...profiles];
    }

    await AsyncStorage.setItem(FVE_CLIENT_PROFILES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function deleteClientProfile(id: string): Promise<ClientProfile[]> {
  try {
    const profiles = await getSavedClientProfiles();
    const updated = profiles.filter((p) => p.id !== id);
    await AsyncStorage.setItem(FVE_CLIENT_PROFILES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<SupabaseTestResult> {
  const start = Date.now();
  const trimmedUrl = (url || '').trim();
  const trimmedKey = (anonKey || '').trim();

  if (!trimmedUrl || !trimmedKey) {
    return {
      ok: false,
      latencyMs: 0,
      hasBrandingTable: false,
      hasMembersTable: false,
      error: 'Both Supabase URL and Anon/Publishable Key are required.',
    };
  }

  try {
    const testClient = createClient(trimmedUrl, trimmedKey, {
      auth: { persistSession: false },
    });

    const [brandingRes, membersRes] = await Promise.allSettled([
      testClient.from('gym_branding').select('id').limit(1),
      testClient.from('members').select('id').limit(1),
    ]);

    const latencyMs = Math.max(1, Date.now() - start);
    const hasBrandingTable = brandingRes.status === 'fulfilled' && !brandingRes.value.error;
    const hasMembersTable = membersRes.status === 'fulfilled' && !membersRes.value.error;

    if (brandingRes.status === 'rejected' || membersRes.status === 'rejected') {
      const err =
        brandingRes.status === 'rejected'
          ? brandingRes.reason
          : membersRes.status === 'rejected'
          ? membersRes.reason
          : null;
      return {
        ok: false,
        latencyMs,
        hasBrandingTable: false,
        hasMembersTable: false,
        error: (err as Error)?.message || 'Connection check failed.',
      };
    }

    const brandingErr = brandingRes.status === 'fulfilled' ? brandingRes.value.error : null;
    const membersErr = membersRes.status === 'fulfilled' ? membersRes.value.error : null;

    if (brandingErr && membersErr) {
      return {
        ok: false,
        latencyMs,
        hasBrandingTable: false,
        hasMembersTable: false,
        error: brandingErr.message || membersErr.message || 'Database rejected connection.',
      };
    }

    return {
      ok: true,
      latencyMs,
      hasBrandingTable,
      hasMembersTable,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.max(1, Date.now() - start),
      hasBrandingTable: false,
      hasMembersTable: false,
      error: (err as Error)?.message || 'Connection test failed.',
    };
  }
}