import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { AuthUser, UserProfile } from '@/types';

const ACTIVE_STAFF_PROFILE_KEY = 'fitverse_active_staff_profile_id';

interface AuthContextType {
  user: AuthUser | null;
  ownerUser: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  activateStaffProfile: (profile: UserProfile) => Promise<void>;
  clearStaffProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  ownerUser: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  activateStaffProfile: async () => {},
  clearStaffProfile: async () => {},
});

function mapSupabaseUser(
  user: User,
  profile?: { full_name: string | null; role: string | null; avatar_url: string | null; phone: string | null; username: string | null }
): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: profile?.username || user.user_metadata?.username || user.user_metadata?.full_name || user.email!.split('@')[0],
    full_name: profile?.full_name || user.user_metadata?.full_name || null,
    // Fail-closed: default an unknown role to RECEPTIONIST
    role: profile?.role || user.user_metadata?.role || 'RECEPTIONIST',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    phone: profile?.phone || null,
    isStaffProfile: false,
  };
}

function mapStaffProfile(profile: UserProfile): AuthUser {
  const fallbackName = profile.full_name || profile.username || 'Staff Profile';
  return {
    id: profile.id,
    email: profile.email || '',
    username: profile.username || fallbackName.toLowerCase().replace(/\s+/g, '.'),
    full_name: profile.full_name,
    role: profile.role || 'RECEPTIONIST',
    avatar_url: profile.avatar_url || null,
    phone: profile.phone || null,
    isStaffProfile: true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ownerUser, setOwnerUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (authUser: AuthUser) => {
    setUser(authUser);
    if (!authUser.isStaffProfile) setOwnerUser(authUser);
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(ACTIVE_STAFF_PROFILE_KEY);
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setOwnerUser(null);
    }
  };

  const activateStaffProfile = async (profile: UserProfile) => {
    await AsyncStorage.setItem(ACTIVE_STAFF_PROFILE_KEY, profile.id);
    setUser(mapStaffProfile(profile));
  };

  const clearStaffProfile = async () => {
    await AsyncStorage.removeItem(ACTIVE_STAFF_PROFILE_KEY);
    if (ownerUser) {
      setUser(ownerUser);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (supabaseUser: User) => {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, role, avatar_url, phone, username')
          .eq('id', supabaseUser.id)
          .single();

        const mappedOwner = mapSupabaseUser(supabaseUser, profile || undefined);
        const activeProfileId = await AsyncStorage.getItem(ACTIVE_STAFF_PROFILE_KEY);
        let activeProfile: UserProfile | null = null;

        if (activeProfileId && activeProfileId !== mappedOwner.id) {
          const { data } = await supabase
            .from('user_profiles')
            .select('id, username, email, full_name, phone, role, avatar_url')
            .eq('id', activeProfileId)
            .maybeSingle();

          if (data?.role && data.role !== 'OWNER') {
            activeProfile = data as UserProfile;
          } else {
            await AsyncStorage.removeItem(ACTIVE_STAFF_PROFILE_KEY);
          }
        }

        if (mounted) {
          setOwnerUser(mappedOwner);
          setUser(activeProfile ? mapStaffProfile(activeProfile) : mappedOwner);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        if (mounted) setLoading(false);
      }
    };

    // Safety fallback: Ensure auth loading doesn't hang indefinitely on startup
    const authTimeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(authTimeout);
        if (!mounted) return;
        if (session?.user) {
          fetchProfile(session.user);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        clearTimeout(authTimeout);
        console.warn('Supabase getSession failed on launch:', err);
        if (mounted) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setOwnerUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          await fetchProfile(session.user);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ownerUser,
      loading,
      login,
      logout,
      activateStaffProfile,
      clearStaffProfile,
    }),
    [user, ownerUser, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
