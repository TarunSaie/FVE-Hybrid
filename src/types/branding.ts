export interface BrandConfig {
  id: string;
  gym_name: string;
  gym_subtag?: string;
  slogan: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  card_color: string;
  foreground_color: string;
  muted_color: string;
  muted_foreground_color: string;
  border_color: string;
  light_background_color: string;
  light_card_color: string;
  light_foreground_color: string;
  light_border_color: string;
  page_title_prefix: string;
  logo_alt: string;
  accent_text_color: string;
  theme_mode: 'dark' | 'light' | 'system';
  loader_style: 'orbit' | 'pulse' | 'linear';
  is_active: boolean;
}

export interface ThemePresetOption {
  id: string;
  name: string;
  tagline: string;
  primary_color: string;
  secondary_color: string;
  accent_text_color: string;
  dark_background: string;
  dark_card: string;
  dark_border: string;
  light_background: string;
  light_card: string;
  light_border: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  notes?: string;
  createdAt: string;
}

export interface SupabaseTestResult {
  ok: boolean;
  latencyMs: number;
  hasBrandingTable: boolean;
  hasMembersTable: boolean;
  error?: string;
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  id: 'default',
  gym_name: 'FitVerse Elite',
  gym_subtag: 'ELITE',
  slogan: 'Discipline • Strength • Transformation',
  logo_url: '',
  favicon_url: '',
  primary_color: '#EFA100',
  secondary_color: '#0066FF',
  background_color: '#050505',
  card_color: '#111418',
  foreground_color: '#FFFFFF',
  muted_color: '#14171C',
  muted_foreground_color: '#8E959E',
  border_color: 'rgba(239, 161, 0, 0.25)',
  light_background_color: '#F6F8FA',
  light_card_color: '#FFFFFF',
  light_foreground_color: '#0F172A',
  light_border_color: 'rgba(15, 23, 42, 0.08)',
  page_title_prefix: 'FitVerse Elite',
  logo_alt: 'FitVerse Elite',
  accent_text_color: '#050505',
  theme_mode: 'dark',
  loader_style: 'orbit',
  is_active: true,
};

export const THEME_PRESETS: ThemePresetOption[] = [
  {
    id: 'fitverse-gold',
    name: 'FitVerse Obsidian Gold',
    tagline: 'Signature carbon black with radioactive gold & electric blue accents',
    primary_color: '#EFA100',
    secondary_color: '#0066FF',
    accent_text_color: '#050505',
    dark_background: '#050505',
    dark_card: '#111418',
    dark_border: 'rgba(239, 161, 0, 0.25)',
    light_background: '#F6F8FA',
    light_card: '#FFFFFF',
    light_border: 'rgba(15, 23, 42, 0.08)',
  },
  {
    id: 'high-contrast-luxe',
    name: 'High Contrast Luxe',
    tagline: 'Deep obsidian carbon with ultra-sharp amber and crisp typography',
    primary_color: '#F59E0B',
    secondary_color: '#3B82F6',
    accent_text_color: '#000000',
    dark_background: '#000000',
    dark_card: '#0E1015',
    dark_border: 'rgba(245, 158, 11, 0.35)',
    light_background: '#F4F6F9',
    light_card: '#FFFFFF',
    light_border: 'rgba(15, 23, 42, 0.12)',
  },
  {
    id: 'electric-neon',
    name: 'Electric Neon',
    tagline: 'Futuristic cyberpunk neon cyan with deep midnight navy surfaces',
    primary_color: '#00E5FF',
    secondary_color: '#8B5CF6',
    accent_text_color: '#050505',
    dark_background: '#07090E',
    dark_card: '#0F141F',
    dark_border: 'rgba(0, 229, 255, 0.30)',
    light_background: '#F0F9FF',
    light_card: '#FFFFFF',
    light_border: 'rgba(14, 165, 233, 0.20)',
  },
  {
    id: 'crimson-beast',
    name: 'Crimson Beast',
    tagline: 'High-intensity blood-red and flame orange for strength athletes',
    primary_color: '#EF4444',
    secondary_color: '#F97316',
    accent_text_color: '#FFFFFF',
    dark_background: '#0A0606',
    dark_card: '#160D0D',
    dark_border: 'rgba(239, 68, 68, 0.30)',
    light_background: '#FEF2F2',
    light_card: '#FFFFFF',
    light_border: 'rgba(239, 68, 68, 0.20)',
  },
  {
    id: 'emerald-alpha',
    name: 'Emerald Alpha',
    tagline: 'Bioluminescent emerald green and high-focus neon aqua',
    primary_color: '#10B981',
    secondary_color: '#06B6D4',
    accent_text_color: '#050505',
    dark_background: '#050C08',
    dark_card: '#0D1A12',
    dark_border: 'rgba(16, 185, 129, 0.30)',
    light_background: '#F0FDF4',
    light_card: '#FFFFFF',
    light_border: 'rgba(16, 185, 129, 0.20)',
  },
  {
    id: 'executive-slate',
    name: 'Executive Slate',
    tagline: 'Tonal slate and arctic titanium harmony for modern luxury fitness',
    primary_color: '#38BDF8',
    secondary_color: '#94A3B8',
    accent_text_color: '#0B0E14',
    dark_background: '#0A0D14',
    dark_card: '#121722',
    dark_border: 'rgba(56, 189, 248, 0.25)',
    light_background: '#F8FAFC',
    light_card: '#FFFFFF',
    light_border: 'rgba(148, 163, 184, 0.25)',
  },
];
