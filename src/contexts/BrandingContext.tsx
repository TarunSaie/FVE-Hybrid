import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import type { BrandConfig } from '@/types';

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  id: 'default',
  gym_name: 'FitVerse Elite',
  slogan: 'Discipline • Strength • Transformation',
  logo_url: '',
  favicon_url: '',
  primary_color: '#EFA100',
  secondary_color: '#0066FF',
  page_title_prefix: 'FitVerse Elite',
  logo_alt: 'FitVerse Elite',
  accent_text_color: '#050505',
  theme_mode: 'dark',
  is_active: true,
};

export function normalizeBrandConfig(value: Partial<BrandConfig> | null | undefined): BrandConfig {
  return {
    ...DEFAULT_BRAND_CONFIG,
    ...value,
    id: value?.id || 'default',
    gym_name: value?.gym_name || DEFAULT_BRAND_CONFIG.gym_name,
    slogan: value?.slogan || DEFAULT_BRAND_CONFIG.slogan,
    logo_url: value?.logo_url || DEFAULT_BRAND_CONFIG.logo_url,
    favicon_url: value?.favicon_url || DEFAULT_BRAND_CONFIG.favicon_url,
    primary_color: value?.primary_color || DEFAULT_BRAND_CONFIG.primary_color,
    secondary_color: value?.secondary_color || DEFAULT_BRAND_CONFIG.secondary_color,
    page_title_prefix: value?.page_title_prefix || DEFAULT_BRAND_CONFIG.page_title_prefix,
    logo_alt: value?.logo_alt || DEFAULT_BRAND_CONFIG.logo_alt,
    accent_text_color: value?.accent_text_color || DEFAULT_BRAND_CONFIG.accent_text_color,
    theme_mode: value?.theme_mode || DEFAULT_BRAND_CONFIG.theme_mode,
    is_active: value?.is_active ?? DEFAULT_BRAND_CONFIG.is_active,
  };
}

interface BrandingContextType {
  brandConfig: BrandConfig;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  saveBranding: (next: Partial<BrandConfig>) => Promise<{ error?: Error | null }>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(DEFAULT_BRAND_CONFIG);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  const applyConfig = useCallback((nextConfig: BrandConfig) => {
    setBrandConfig(nextConfig);
    if (nextConfig.theme_mode === 'dark' || nextConfig.theme_mode === 'light' || nextConfig.theme_mode === 'system') {
      setTheme(nextConfig.theme_mode);
    }
  }, [setTheme]);

  const refreshBranding = useCallback(async () => {
    const { data, error } = await supabase
      .from('gym_branding')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.error('[branding] load error:', error.message);
      applyConfig(DEFAULT_BRAND_CONFIG);
      return;
    }

    if (data) {
      applyConfig(normalizeBrandConfig(data));
    } else {
      applyConfig(DEFAULT_BRAND_CONFIG);
    }
  }, [applyConfig]);

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      setLoading(true);
      try {
        await refreshBranding();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    boot();
    return () => {
      isMounted = false;
    };
  }, [refreshBranding]);

  const saveBranding = useCallback(async (next: Partial<BrandConfig>) => {
    const merged = normalizeBrandConfig({ ...brandConfig, ...next, id: 'default' });

    const { error } = await supabase
      .from('gym_branding')
      .upsert(merged, { onConflict: 'id' });

    if (error) {
      console.error('[branding] save failed:', error.message);
      return { error: new Error(error.message) };
    }

    applyConfig(merged);
    return { error: null };
  }, [applyConfig, brandConfig]);

  const value = useMemo(() => ({
    brandConfig,
    loading,
    refreshBranding,
    saveBranding,
  }), [brandConfig, loading, refreshBranding, saveBranding]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
