import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/api/supabase';
import { BrandConfig, DEFAULT_BRAND_CONFIG } from '@/types/branding';

const FVE_BRAND_STORAGE_KEY = '@fve_brand_config';

export interface BrandingContextType {
  brandConfig: BrandConfig;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  saveBranding: (next: Partial<BrandConfig>) => Promise<{ error?: Error | null; schemaNotice?: string }>;
  resetBranding: () => Promise<{ error?: Error | null; schemaNotice?: string }>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function normalizeBrandConfig(raw: Partial<BrandConfig> | null | undefined): BrandConfig {
  if (!raw) return DEFAULT_BRAND_CONFIG;

  return {
    id: raw.id || DEFAULT_BRAND_CONFIG.id,
    gym_name: raw.gym_name || DEFAULT_BRAND_CONFIG.gym_name,
    gym_subtag: raw.gym_subtag || DEFAULT_BRAND_CONFIG.gym_subtag || 'ELITE',
    slogan: raw.slogan || DEFAULT_BRAND_CONFIG.slogan,
    logo_url: raw.logo_url || DEFAULT_BRAND_CONFIG.logo_url,
    favicon_url: raw.favicon_url || DEFAULT_BRAND_CONFIG.favicon_url,
    primary_color: raw.primary_color || DEFAULT_BRAND_CONFIG.primary_color,
    secondary_color: raw.secondary_color || DEFAULT_BRAND_CONFIG.secondary_color,
    background_color: raw.background_color || DEFAULT_BRAND_CONFIG.background_color,
    card_color: raw.card_color || DEFAULT_BRAND_CONFIG.card_color,
    foreground_color: raw.foreground_color || DEFAULT_BRAND_CONFIG.foreground_color,
    muted_color: raw.muted_color || DEFAULT_BRAND_CONFIG.muted_color,
    muted_foreground_color: raw.muted_foreground_color || DEFAULT_BRAND_CONFIG.muted_foreground_color,
    border_color: raw.border_color || DEFAULT_BRAND_CONFIG.border_color,
    light_background_color: raw.light_background_color || DEFAULT_BRAND_CONFIG.light_background_color,
    light_card_color: raw.light_card_color || DEFAULT_BRAND_CONFIG.light_card_color,
    light_foreground_color: raw.light_foreground_color || DEFAULT_BRAND_CONFIG.light_foreground_color,
    light_border_color: raw.light_border_color || DEFAULT_BRAND_CONFIG.light_border_color,
    page_title_prefix: raw.page_title_prefix || DEFAULT_BRAND_CONFIG.page_title_prefix,
    logo_alt: raw.logo_alt || DEFAULT_BRAND_CONFIG.logo_alt,
    accent_text_color: raw.accent_text_color || DEFAULT_BRAND_CONFIG.accent_text_color,
    theme_mode: raw.theme_mode === 'light' || raw.theme_mode === 'dark' || raw.theme_mode === 'system' ? raw.theme_mode : 'dark',
    loader_style: raw.loader_style === 'pulse' || raw.loader_style === 'linear' ? raw.loader_style : 'orbit',
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
  };
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(DEFAULT_BRAND_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load cached branding from AsyncStorage immediately on mount
  useEffect(() => {
    async function loadCached() {
      try {
        const cached = await AsyncStorage.getItem(FVE_BRAND_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setBrandConfig(normalizeBrandConfig(parsed));
        }
      } catch (err) {
        console.warn('Failed to read cached branding:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCached();
  }, []);

  // Fetch from Supabase gym_branding
  const refreshBranding = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('gym_branding')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch gym_branding from Supabase:', error.message);
        return;
      }

      if (data) {
        const normalized = normalizeBrandConfig(data);
        setBrandConfig(normalized);
        await AsyncStorage.setItem(FVE_BRAND_STORAGE_KEY, JSON.stringify(normalized)).catch(() => {});
      }
    } catch (err) {
      console.warn('Error refreshing branding:', err);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  // Save branding updates
  const saveBranding = useCallback(
    async (next: Partial<BrandConfig>): Promise<{ error?: Error | null; schemaNotice?: string }> => {
      const merged = normalizeBrandConfig({ ...brandConfig, ...next, id: 'default' });

      // 1. Optimistically update state & local AsyncStorage cache immediately
      setBrandConfig(merged);
      await AsyncStorage.setItem(FVE_BRAND_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});

      // 2. Persist to Supabase gym_branding
      const fullPayload = {
        id: 'default',
        gym_name: merged.gym_name,
        gym_subtag: merged.gym_subtag,
        slogan: merged.slogan,
        logo_url: merged.logo_url,
        favicon_url: merged.favicon_url,
        page_title_prefix: merged.page_title_prefix,
        logo_alt: merged.logo_alt,
        primary_color: merged.primary_color,
        secondary_color: merged.secondary_color,
        background_color: merged.background_color,
        card_color: merged.card_color,
        foreground_color: merged.foreground_color,
        muted_color: merged.muted_color,
        muted_foreground_color: merged.muted_foreground_color,
        border_color: merged.border_color,
        light_background_color: merged.light_background_color,
        light_card_color: merged.light_card_color,
        light_foreground_color: merged.light_foreground_color,
        light_border_color: merged.light_border_color,
        loader_style: merged.loader_style,
        accent_text_color: merged.accent_text_color,
        theme_mode: merged.theme_mode,
        is_active: merged.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('gym_branding')
        .upsert(fullPayload, { onConflict: 'id' });

      if (error) {
        // Fallback for legacy schema (if new palette columns don't exist yet on client db)
        const basePayload = {
          id: 'default',
          gym_name: merged.gym_name,
          slogan: merged.slogan,
          logo_url: merged.logo_url,
          favicon_url: merged.favicon_url,
          page_title_prefix: merged.page_title_prefix,
          logo_alt: merged.logo_alt,
          primary_color: merged.primary_color,
          secondary_color: merged.secondary_color,
          accent_text_color: merged.accent_text_color,
          theme_mode: merged.theme_mode,
          is_active: merged.is_active,
          updated_at: new Date().toISOString(),
        };

        const { error: fallbackError } = await supabase
          .from('gym_branding')
          .upsert(basePayload, { onConflict: 'id' });

        if (fallbackError) {
          return { error: fallbackError };
        }

        return {
          error: null,
          schemaNotice: 'Saved with legacy database schema. Run the Brand Studio SQL migration on Supabase to enable all surface colors.',
        };
      }

      return { error: null };
    },
    [brandConfig]
  );

  const resetBranding = useCallback(async (): Promise<{ error?: Error | null; schemaNotice?: string }> => {
    return saveBranding(DEFAULT_BRAND_CONFIG);
  }, [saveBranding]);

  const value = useMemo(
    () => ({
      brandConfig,
      loading,
      refreshBranding,
      saveBranding,
      resetBranding,
    }),
    [brandConfig, loading, refreshBranding, saveBranding, resetBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export function useBranding(): BrandingContextType {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      brandConfig: DEFAULT_BRAND_CONFIG,
      loading: false,
      refreshBranding: async () => {},
      saveBranding: async () => ({ error: null }),
      resetBranding: async () => ({ error: null }),
    };
  }
  return context;
}
