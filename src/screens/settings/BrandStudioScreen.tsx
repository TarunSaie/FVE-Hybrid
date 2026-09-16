import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import {
  Palette,
  Layers,
  Database,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  Trash2,
  Copy,
  RotateCcw,
  Save,
  ExternalLink,
  ShieldCheck,
  Server,
  Zap,
  Package,
  Terminal,
  Smartphone,
  Info,
  Folder,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEKeyboardAwareContainer } from '@/components/common/FVEKeyboardAwareContainer';
import { useBranding } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessBrandStudio } from '@/constants/permissions';
import { useDialog } from '@/contexts/DialogContext';
import {
  BrandConfig,
  THEME_PRESETS,
  ThemePresetOption,
  ClientProfile,
  SupabaseTestResult,
  DEFAULT_BRAND_CONFIG,
} from '@/types/branding';
import {
  getActiveSupabaseConfig,
  setCustomSupabaseConfig,
  resetSupabaseConfig,
  getSavedClientProfiles,
  saveClientProfile,
  deleteClientProfile,
  testSupabaseConnection,
  supabase,
  SupabaseConnectionConfig,
} from '@/utils/supabase';
import { typography } from '@/constants/typography';
import { ThemeColors } from '@/constants/colors';
import { haptics } from '@/utils/haptics';

const MIGRATION_SQL = `-- FitVerse Elite Gym Branding Setup
CREATE TABLE IF NOT EXISTS public.gym_branding (
  id TEXT PRIMARY KEY DEFAULT 'default',
  gym_name TEXT NOT NULL DEFAULT 'FitVerse Elite',
  slogan TEXT NOT NULL DEFAULT 'Discipline • Strength • Transformation',
  logo_url TEXT NOT NULL DEFAULT '',
  favicon_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#EFA100',
  secondary_color TEXT NOT NULL DEFAULT '#0066FF',
  background_color TEXT NOT NULL DEFAULT '#050505',
  card_color TEXT NOT NULL DEFAULT '#111418',
  foreground_color TEXT NOT NULL DEFAULT '#FFFFFF',
  muted_color TEXT NOT NULL DEFAULT '#14171C',
  muted_foreground_color TEXT NOT NULL DEFAULT '#8E959E',
  border_color TEXT NOT NULL DEFAULT 'rgba(239, 161, 0, 0.25)',
  light_background_color TEXT NOT NULL DEFAULT '#F6F8FA',
  light_card_color TEXT NOT NULL DEFAULT '#FFFFFF',
  light_foreground_color TEXT NOT NULL DEFAULT '#0F172A',
  light_border_color TEXT NOT NULL DEFAULT 'rgba(15, 23, 42, 0.08)',
  page_title_prefix TEXT NOT NULL DEFAULT 'FitVerse Elite',
  gym_subtag TEXT NOT NULL DEFAULT 'ELITE',
  logo_alt TEXT NOT NULL DEFAULT 'FitVerse Elite',
  accent_text_color TEXT NOT NULL DEFAULT '#050505',
  theme_mode TEXT NOT NULL DEFAULT 'dark',
  loader_style TEXT NOT NULL DEFAULT 'orbit',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public RLS Policies
ALTER TABLE public.gym_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branding read public" ON public.gym_branding;
CREATE POLICY "Branding read public" ON public.gym_branding FOR SELECT USING (true);
DROP POLICY IF EXISTS "Branding write public" ON public.gym_branding;
CREATE POLICY "Branding write public" ON public.gym_branding FOR ALL USING (true) WITH CHECK (true);
`;

const QUICK_PRIMARY_SWATCHES = [
  '#EFA100', // Gold
  '#F59E0B', // Amber
  '#00E5FF', // Neon Cyan
  '#EF4444', // Crimson
  '#10B981', // Emerald
  '#A855F7', // Purple
];

const QUICK_SECONDARY_SWATCHES = [
  '#0066FF', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#94A3B8', // Slate
];

export function BrandStudioScreen() {
  const { user } = useAuth();
  const { brandConfig, saveBranding, resetBranding } = useBranding();
  const { colors, isDark } = useTheme();
  const dialog = useDialog();

  if (!canAccessBrandStudio(user?.role, user?.email)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <FVEHeader title="Brand Studio" showBack />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <ShieldCheck size={48} color={colors.gold} style={{ marginBottom: 16 }} />
          <Text style={{ fontFamily: typography.fonts.rajdhani, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
            Chirvex Developer Tool
          </Text>
          <Text style={{ fontFamily: typography.fonts.inter, fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: 20 }}>
            Brand Studio & Client Manager is restricted to Chirvex deployment engineers and internal administrators.
          </Text>
        </View>
      </View>
    );
  }

  const [activeTab, setActiveTab] = useState<'branding' | 'supabase' | 'build'>('branding');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopyCommand = async (cmd: string, label: string) => {
    await Clipboard.setStringAsync(cmd);
    setCopiedCommand(label);
    haptics.success();
    dialog.alert('Command Copied', `"${cmd}" copied to clipboard.`);
    setTimeout(() => setCopiedCommand(null), 3000);
  };

  const handleCopyEnvConfig = async () => {
    const url = supabaseConfig.url || 'https://your-project.supabase.co';
    const key = supabaseConfig.anonKey || 'your-anon-key';
    const envSnippet = `# FitVerse Elite Client Mobile Environment
EXPO_PUBLIC_SUPABASE_URL=${url}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${key}
EXPO_PUBLIC_SUPABASE_KEY=${key}
`;
    await Clipboard.setStringAsync(envSnippet);
    haptics.success();
    dialog.alert(
      'Environment Config Copied',
      'Paste this into fve-mobile/.env before compiling the client APK.'
    );
  };

  const handleCopyApkPath = async () => {
    const apkPath = 'android/app/build/outputs/apk/release/app-release.apk';
    await Clipboard.setStringAsync(apkPath);
    haptics.success();
    dialog.alert('Path Copied', `"${apkPath}" copied to clipboard.`);
  };
  const [draft, setDraft] = useState<BrandConfig>(brandConfig);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [previewDark, setPreviewDark] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Supabase Multi-Client state
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConnectionConfig>({
    url: '',
    anonKey: '',
    isCustom: false,
    defaultUrl: '',
    defaultAnonKey: '',
  });
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([]);
  const [clientUrlInput, setClientUrlInput] = useState('');
  const [clientKeyInput, setClientKeyInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<SupabaseTestResult | null>(null);

  // Sync draft whenever active brand config updates
  useEffect(() => {
    setDraft(brandConfig);
  }, [brandConfig]);

  // Load active Supabase config & client profiles on mount
  useEffect(() => {
    async function loadConfig() {
      const cfg = await getActiveSupabaseConfig();
      setSupabaseConfig(cfg);
      const profiles = await getSavedClientProfiles();
      setClientProfiles(profiles);
    }
    loadConfig();
  }, []);

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // ── Preset Selection ──
  const handleSelectPreset = (preset: ThemePresetOption) => {
    haptics.selection();
    setSelectedPresetId(preset.id);
    setDraft((prev) => ({
      ...prev,
      primary_color: preset.primary_color,
      secondary_color: preset.secondary_color,
      accent_text_color: preset.accent_text_color,
      background_color: preset.dark_background,
      card_color: preset.dark_card,
      border_color: preset.dark_border,
      light_background_color: preset.light_background,
      light_card_color: preset.light_card,
      light_border_color: preset.light_border,
    }));
  };

  // ── Logo Picker via expo-image-picker ──
  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        dialog.alert(
          'Permission Required',
          'Please allow access to your photo library to choose a gym logo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploadingLogo(true);
      haptics.light();

      const asset = result.assets[0];
      let finalUrl = '';

      // Upload to Supabase Storage 'brand-assets' if available
      if (asset.base64) {
        try {
          const fileName = `logo-${Date.now()}.png`;
          const base64Data = asset.base64;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);

          const { data, error } = await supabase.storage
            .from('brand-assets')
            .upload(fileName, byteArray, {
              contentType: 'image/png',
              upsert: true,
            });

          if (!error && data?.path) {
            const { data: publicUrlData } = supabase.storage
              .from('brand-assets')
              .getPublicUrl(data.path);
            if (publicUrlData?.publicUrl) {
              finalUrl = publicUrlData.publicUrl;
            }
          }
        } catch {
          // Fallback to data URI
        }
      }

      // Fallback to inlined data URI if storage upload wasn't possible
      if (!finalUrl && asset.base64) {
        finalUrl = `data:image/png;base64,${asset.base64}`;
      } else if (!finalUrl && asset.uri) {
        finalUrl = asset.uri;
      }

      setDraft((prev) => ({ ...prev, logo_url: finalUrl }));
      haptics.success();
      dialog.alert('Logo Selected', 'Gym logo updated. Remember to tap "Save Branding" below.');
    } catch (err) {
      haptics.error();
      dialog.alert('Error', (err as Error).message || 'Failed to select logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    haptics.selection();
    setDraft((prev) => ({ ...prev, logo_url: '' }));
  };

  // ── Save Branding Action ──
  const handleSaveBranding = async () => {
    setSaving(true);
    haptics.selection();
    try {
      const res = await saveBranding(draft);
      if (res.error) {
        haptics.error();
        dialog.alert('Save Failed', res.error.message);
      } else {
        haptics.success();
        dialog.alert(
          'Branding Saved',
          res.schemaNotice ||
            `Branding for "${draft.gym_name}" successfully saved and synchronized across the platform.`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Reset Branding Action ──
  const handleResetToDefaults = () => {
    haptics.warning();
    dialog.danger(
      'Reset Branding?',
      'This will revert all colors, logos, and gym identity to the default FitVerse Elite theme.',
      'Reset to Default',
      async () => {
        setSaving(true);
        try {
          await resetBranding();
          setDraft(DEFAULT_BRAND_CONFIG);
          setSelectedPresetId(null);
          haptics.success();
          dialog.alert('Reset Complete', 'Brand settings restored to default.');
        } catch (err) {
          haptics.error();
          dialog.alert('Error', (err as Error).message || 'Failed to reset branding');
        } finally {
          setSaving(false);
        }
      }
    );
  };

  // ── Supabase Multi-Client Handlers ──
  const handleTestConnection = async () => {
    const targetUrl = clientUrlInput.trim() || supabaseConfig.url;
    const targetKey = clientKeyInput.trim() || supabaseConfig.anonKey;

    if (!targetUrl || !targetKey) {
      dialog.alert('Missing Info', 'Please enter both Supabase URL and Anon / Publishable Key.');
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    haptics.light();
    try {
      const res = await testSupabaseConnection(targetUrl, targetKey);
      setTestResult(res);
      if (res.ok) {
        haptics.success();
      } else {
        haptics.error();
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleApplyClientCredentials = async () => {
    const targetUrl = clientUrlInput.trim();
    const targetKey = clientKeyInput.trim();
    const targetName = clientNameInput.trim();

    if (!targetUrl || !targetKey) {
      dialog.alert('Required Fields', 'Both Supabase URL and Anon / Publishable Key are required.');
      return;
    }

    const test = await testSupabaseConnection(targetUrl, targetKey);
    if (!test.ok) {
      dialog.alert('Connection Failed', test.error || 'Could not connect to the specified database.');
      return;
    }

    const result = await setCustomSupabaseConfig(targetUrl, targetKey);
    if (!result.success) {
      dialog.alert('Error', result.error || 'Failed to apply credentials.');
      return;
    }

    if (targetName) {
      const updated = await saveClientProfile({
        name: targetName,
        url: targetUrl,
        anonKey: targetKey,
      });
      setClientProfiles(updated);
    }

    const updatedCfg = await getActiveSupabaseConfig();
    setSupabaseConfig(updatedCfg);
    haptics.success();
    dialog.alert(
      'Connected to Client Database',
      'The app is now configured for the new database. Please restart or sign in to load client data.'
    );
  };

  const handleResetToEnvCredentials = () => {
    dialog.confirm(
      'Reset to Default Database?',
      'This will switch the application back to the standard environment database credentials.',
      async () => {
        await resetSupabaseConfig();
        const updatedCfg = await getActiveSupabaseConfig();
        setSupabaseConfig(updatedCfg);
        haptics.success();
        dialog.alert('Reset Successful', 'App reverted to default database.');
      }
    );
  };

  const handleSwitchProfile = (profile: ClientProfile) => {
    dialog.confirm(
      `Switch to ${profile.name}?`,
      `Reconnecting to ${profile.url}. Active session will switch to this client database.`,
      async () => {
        await setCustomSupabaseConfig(profile.url, profile.anonKey);
        const updatedCfg = await getActiveSupabaseConfig();
        setSupabaseConfig(updatedCfg);
        haptics.success();
        dialog.alert('Switched', `Connected to ${profile.name}.`);
      }
    );
  };

  const handleDeleteProfile = (profile: ClientProfile) => {
    dialog.danger(
      'Delete Profile?',
      `Remove "${profile.name}" from your saved profiles list?`,
      'Delete Profile',
      async () => {
        const updated = await deleteClientProfile(profile.id);
        setClientProfiles(updated);
        haptics.success();
      }
    );
  };

  const handleCopySql = async () => {
    await Clipboard.setStringAsync(MIGRATION_SQL);
    haptics.success();
    dialog.alert('Copied', 'Database setup SQL copied to clipboard.');
  };

  return (
    <View style={styles.container}>
      <FVEHeader title="BRAND STUDIO" showBack />

      {/* Segmented Top Bar */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('branding');
          }}
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'branding' && styles.tabButtonActive]}
        >
          <Layers
            size={16}
            color={activeTab === 'branding' ? '#050505' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'branding' && styles.tabButtonTextActive]}
          >
            Brand & Theme
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('supabase');
          }}
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'supabase' && styles.tabButtonActive]}
        >
          <Database
            size={16}
            color={activeTab === 'supabase' ? '#050505' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'supabase' && styles.tabButtonTextActive]}
          >
            Supabase Switcher
          </Text>
          {supabaseConfig.isCustom && <View style={styles.customDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('build');
          }}
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'build' && styles.tabButtonActive]}
        >
          <Package
            size={16}
            color={activeTab === 'build' ? '#050505' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'build' && styles.tabButtonTextActive]}
          >
            APK Build
          </Text>
        </TouchableOpacity>
      </View>

      <FVEKeyboardAwareContainer contentContainerStyle={styles.scrollContent}>
        {activeTab === 'branding' ? (
          <>
            {/* ── LIVE MOBILE PREVIEW CARD ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Sparkles size={16} color={draft.primary_color} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>LIVE APP PREVIEW</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setPreviewDark(!previewDark);
                  }}
                  style={styles.previewModeToggle}
                >
                  <Text style={styles.previewModeText}>
                    {previewDark ? 'Dark Mockup' : 'Light Mockup'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>
                See how headers, cards, and buttons render in real time with your custom palette.
              </Text>

              <View
                style={[
                  styles.mockupFrame,
                  {
                    backgroundColor: previewDark ? draft.background_color : draft.light_background_color,
                    borderColor: draft.primary_color + '40',
                  },
                ]}
              >
                {/* Mockup Header */}
                <View
                  style={[
                    styles.mockupHeader,
                    {
                      backgroundColor: previewDark ? draft.card_color : draft.light_card_color,
                      borderBottomColor: previewDark ? draft.border_color : draft.light_border_color,
                    },
                  ]}
                >
                  <View style={styles.mockupHeaderLeft}>
                    {draft.logo_url ? (
                      <Image source={{ uri: draft.logo_url }} style={styles.mockupLogo} />
                    ) : (
                      <View
                        style={[styles.mockupLogoPlaceholder, { backgroundColor: draft.primary_color }]}
                      >
                        <Text style={[styles.mockupLogoInitial, { color: draft.accent_text_color }]}>
                          {draft.gym_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text
                        numberOfLines={1}
                        style={[styles.mockupGymTitle, { color: draft.primary_color }]}
                      >
                        {(draft.gym_name || 'FitVerse Elite').toUpperCase()}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.mockupGymSlogan, { color: draft.secondary_color }]}
                      >
                        {(draft.gym_subtag || 'ELITE').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.mockupBadge,
                      {
                        backgroundColor: draft.primary_color + '20',
                        borderColor: draft.primary_color + '50',
                      },
                    ]}
                  >
                    <Text style={[styles.mockupBadgeText, { color: draft.primary_color }]}>
                      ACTIVE
                    </Text>
                  </View>
                </View>

                {/* Mockup Content Card */}
                <View
                  style={[
                    styles.mockupCard,
                    {
                      backgroundColor: previewDark ? draft.card_color : draft.light_card_color,
                      borderColor: previewDark ? draft.border_color : draft.light_border_color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.mockupCardLabel,
                      { color: previewDark ? '#9AA3AF' : '#64748B' },
                    ]}
                  >
                    TODAY'S ACTIVE MEMBERS
                  </Text>
                  <Text
                    style={[
                      styles.mockupCardValue,
                      { color: previewDark ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    148 / 200
                  </Text>
                  <View style={styles.mockupProgressTrack}>
                    <View
                      style={[
                        styles.mockupProgressBar,
                        { backgroundColor: draft.primary_color, width: '74%' },
                      ]}
                    />
                  </View>
                </View>

                {/* Mockup Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.mockupButton, { backgroundColor: draft.primary_color }]}
                >
                  <Text style={[styles.mockupButtonText, { color: draft.accent_text_color }]}>
                    QUICK QR CHECK-IN
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── GYM IDENTITY ── */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>GYM IDENTITY</Text>
              <Text style={styles.sectionSubtitle}>
                Customize the commercial brand identity of your fitness club.
              </Text>

              <Text style={styles.inputLabel}>GYM NAME</Text>
              <TextInput
                style={styles.textInput}
                value={draft.gym_name}
                onChangeText={(t) => setDraft((prev) => ({ ...prev, gym_name: t }))}
                placeholder="e.g. Iron Temple Fitness"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>GYM NAME SUB-TAG</Text>
              <TextInput
                style={styles.textInput}
                value={draft.gym_subtag || ''}
                onChangeText={(t) => setDraft((prev) => ({ ...prev, gym_subtag: t }))}
                placeholder="e.g. ELITE or FITNESS CLUB"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>PAGE TITLE PREFIX (BROWSER & APP)</Text>
              <TextInput
                style={styles.textInput}
                value={draft.page_title_prefix}
                onChangeText={(t) => setDraft((prev) => ({ ...prev, page_title_prefix: t }))}
                placeholder="e.g. FitVerse Elite"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>SLOGAN / TAGLINE</Text>
              <TextInput
                style={styles.textInput}
                value={draft.slogan}
                onChangeText={(t) => setDraft((prev) => ({ ...prev, slogan: t }))}
                placeholder="e.g. Strength • Discipline • Glory"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* ── BRAND LOGO ASSET ── */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>BRAND LOGO</Text>
              <Text style={styles.sectionSubtitle}>
                Upload a square logo for headers, member cards, and generated PDF receipts.
              </Text>

              <View style={styles.logoRow}>
                <View style={styles.logoPreviewBox}>
                  {draft.logo_url ? (
                    <Image
                      source={{ uri: draft.logo_url }}
                      style={styles.logoPreviewImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Image
                      source={require('@/../assets/logo.png')}
                      style={styles.logoPreviewImage}
                      resizeMode="contain"
                    />
                  )}
                </View>

                <View style={styles.logoActions}>
                  <TouchableOpacity
                    onPress={handlePickLogo}
                    disabled={uploadingLogo}
                    style={styles.uploadBtn}
                  >
                    {uploadingLogo ? (
                      <ActivityIndicator size="small" color="#050505" />
                    ) : (
                      <>
                        <ImagePlus size={16} color="#050505" style={{ marginRight: 6 }} />
                        <Text style={styles.uploadBtnText}>Choose Photo</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {draft.logo_url ? (
                    <TouchableOpacity onPress={handleRemoveLogo} style={styles.removeLogoBtn}>
                      <Trash2 size={14} color={colors.error} style={{ marginRight: 4 }} />
                      <Text style={styles.removeLogoBtnText}>Reset Logo</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            {/* ── CURATED THEME PRESETS ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Palette size={16} color={draft.primary_color} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>THEME PRESETS</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Select an expertly coordinated color palette tailored for gym aesthetics.
              </Text>

              <View style={styles.presetsGrid}>
                {THEME_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => handleSelectPreset(preset)}
                      activeOpacity={0.8}
                      style={[styles.presetCard, isSelected && styles.presetCardActive]}
                    >
                      <View style={styles.presetTopRow}>
                        <View style={styles.presetSwatches}>
                          <View
                            style={[
                              styles.swatchDot,
                              { backgroundColor: preset.primary_color, zIndex: 2 },
                            ]}
                          />
                          <View
                            style={[
                              styles.swatchDot,
                              {
                                backgroundColor: preset.secondary_color,
                                marginLeft: -8,
                                zIndex: 1,
                              },
                            ]}
                          />
                        </View>
                        {isSelected && (
                          <View style={styles.presetCheckPill}>
                            <Check size={12} color="#050505" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      <Text numberOfLines={2} style={styles.presetTagline}>
                        {preset.tagline}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── CUSTOM COLOR PALETTE ── */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>COLOR CUSTOMIZATION</Text>
              <Text style={styles.sectionSubtitle}>
                Fine-tune specific hex codes for primary buttons and secondary accents.
              </Text>

              {/* Primary Color */}
              <Text style={styles.inputLabel}>PRIMARY COLOR (HEX)</Text>
              <View style={styles.hexInputRow}>
                <View
                  style={[styles.colorPreviewChip, { backgroundColor: draft.primary_color }]}
                />
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  value={draft.primary_color}
                  onChangeText={(t) => setDraft((prev) => ({ ...prev, primary_color: t }))}
                  placeholder="#EFA100"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.quickSwatchesRow}>
                {QUICK_PRIMARY_SWATCHES.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => {
                      haptics.selection();
                      setDraft((prev) => ({ ...prev, primary_color: hex }));
                    }}
                    style={[
                      styles.quickSwatchCircle,
                      { backgroundColor: hex },
                      draft.primary_color.toUpperCase() === hex.toUpperCase() &&
                        styles.quickSwatchCircleActive,
                    ]}
                  />
                ))}
              </View>

              {/* Secondary Color */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>SECONDARY COLOR (HEX)</Text>
              <View style={styles.hexInputRow}>
                <View
                  style={[styles.colorPreviewChip, { backgroundColor: draft.secondary_color }]}
                />
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  value={draft.secondary_color}
                  onChangeText={(t) => setDraft((prev) => ({ ...prev, secondary_color: t }))}
                  placeholder="#0066FF"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.quickSwatchesRow}>
                {QUICK_SECONDARY_SWATCHES.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => {
                      haptics.selection();
                      setDraft((prev) => ({ ...prev, secondary_color: hex }));
                    }}
                    style={[
                      styles.quickSwatchCircle,
                      { backgroundColor: hex },
                      draft.secondary_color.toUpperCase() === hex.toUpperCase() &&
                        styles.quickSwatchCircleActive,
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* ── SAVE & RESET ACTIONS ── */}
            <View style={styles.actionsContainer}>
              <FVEButton
                title={saving ? 'SAVING BRANDING...' : 'SAVE BRANDING'}
                onPress={handleSaveBranding}
                loading={saving}
                variant="gold"
                size="lg"
                icon={<Save size={18} color="#050505" />}
              />

              <TouchableOpacity
                onPress={handleResetToDefaults}
                disabled={saving}
                style={styles.resetBtn}
                activeOpacity={0.7}
              >
                <RotateCcw size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.resetBtnText}>Reset to Default FitVerse Elite</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : activeTab === 'supabase' ? (
          <>
            {/* ── SUPABASE MULTI-CLIENT TAB ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Server size={16} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>ACTIVE DATABASE CONNECTION</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                FitVerse Elite supports multi-tenant operations. Connect to client gym Supabase instances on the fly.
              </Text>

              <View
                style={[
                  styles.connectionCard,
                  {
                    borderColor: supabaseConfig.isCustom
                      ? colors.blue
                      : isDark
                      ? colors.goldBorder
                      : colors.borderDark,
                  },
                ]}
              >
                <View style={styles.connectionHeader}>
                  <View style={styles.connectionBadgeRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: supabaseConfig.isCustom ? colors.blue : colors.success },
                      ]}
                    />
                    <Text style={styles.connectionStatusTitle}>
                      {supabaseConfig.isCustom
                        ? 'Custom Client Database'
                        : 'Default Production Database (.env)'}
                    </Text>
                  </View>
                  <FVEBadge
                    label={supabaseConfig.isCustom ? 'CUSTOM' : 'DEFAULT'}
                    color={supabaseConfig.isCustom ? colors.blue : colors.success}
                    bgColor={supabaseConfig.isCustom ? colors.blueMuted : colors.successMuted}
                    borderColor={supabaseConfig.isCustom ? colors.blueBorder : colors.successBorder}
                    size="sm"
                  />
                </View>

                <Text style={styles.connectionUrlLabel}>PROJECT ENDPOINT</Text>
                <Text numberOfLines={1} style={styles.connectionUrlValue}>
                  {supabaseConfig.url}
                </Text>

                {supabaseConfig.isCustom && (
                  <TouchableOpacity
                    onPress={handleResetToEnvCredentials}
                    style={styles.revertEnvBtn}
                  >
                    <RotateCcw size={14} color={colors.gold} style={{ marginRight: 6 }} />
                    <Text style={styles.revertEnvBtnText}>Revert to Default (.env)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── CONNECT NEW CLIENT DATABASE ── */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>CONNECT CLIENT SUPABASE</Text>
              <Text style={styles.sectionSubtitle}>
                Enter the Supabase URL and Anon/Publishable Key for the client's dedicated gym database.
              </Text>

              <Text style={styles.inputLabel}>CLIENT GYM NAME (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                value={clientNameInput}
                onChangeText={setClientNameInput}
                placeholder="e.g. Titan Gym Mumbai"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>SUPABASE PROJECT URL</Text>
              <TextInput
                style={styles.textInput}
                value={clientUrlInput}
                onChangeText={setClientUrlInput}
                placeholder="https://xyzcompany.supabase.co"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={styles.inputLabel}>ANON / PUBLISHABLE KEY</Text>
              <TextInput
                style={styles.textInput}
                value={clientKeyInput}
                onChangeText={setClientKeyInput}
                placeholder="sb_publishable_... or JWT Anon Key"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                secureTextEntry
              />

              {/* Test Connection Button */}
              <View style={styles.clientFormActions}>
                <TouchableOpacity
                  onPress={handleTestConnection}
                  disabled={testingConnection}
                  style={styles.testConnectionBtn}
                  activeOpacity={0.75}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <>
                      <Zap size={15} color={colors.gold} style={{ marginRight: 6 }} />
                      <Text style={styles.testConnectionBtnText}>Test Latency & Tables</Text>
                    </>
                  )}
                </TouchableOpacity>

                <FVEButton
                  title="APPLY & SWITCH"
                  onPress={handleApplyClientCredentials}
                  variant="gold"
                  size="md"
                  style={{ marginTop: 10 }}
                />
              </View>

              {/* Test Result Feedback */}
              {testResult && (
                <View
                  style={[
                    styles.testResultBox,
                    {
                      borderColor: testResult.ok ? colors.success : colors.error,
                      backgroundColor: testResult.ok
                        ? colors.successMuted
                        : colors.errorMuted,
                    },
                  ]}
                >
                  <View style={styles.testResultRow}>
                    {testResult.ok ? (
                      <CheckCircle2 size={16} color={colors.success} style={{ marginRight: 8 }} />
                    ) : (
                      <AlertCircle size={16} color={colors.error} style={{ marginRight: 8 }} />
                    )}
                    <Text
                      style={[
                        styles.testResultText,
                        { color: testResult.ok ? colors.success : colors.error },
                      ]}
                    >
                      {testResult.ok
                        ? `Connected! Latency: ${testResult.latencyMs}ms (Branding: ${
                            testResult.hasBrandingTable ? 'OK' : 'Missing'
                          }, Members: ${testResult.hasMembersTable ? 'OK' : 'Missing'})`
                        : testResult.error || 'Connection check failed'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── SAVED CLIENT PROFILES ── */}
            {clientProfiles.length > 0 && (
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>SAVED CLIENT GYMS</Text>
                <Text style={styles.sectionSubtitle}>
                  Fast-switch between connected client gym databases.
                </Text>

                {clientProfiles.map((profile) => (
                  <View key={profile.id} style={styles.profileItem}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.profileName}>{profile.name}</Text>
                      <Text numberOfLines={1} style={styles.profileUrl}>
                        {profile.url}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleSwitchProfile(profile)}
                      style={styles.switchProfileBtn}
                    >
                      <Text style={styles.switchProfileBtnText}>Connect</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteProfile(profile)}
                      style={styles.deleteProfileBtn}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── MIGRATION SQL ASSISTANT ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <ShieldCheck size={16} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>CLIENT SETUP SQL SCRIPT</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Run this SQL query in the Supabase SQL Editor of any new gym database to enable branding and storage.
              </Text>

              <TouchableOpacity onPress={handleCopySql} style={styles.copySqlBtn}>
                <Copy size={15} color="#050505" style={{ marginRight: 6 }} />
                <Text style={styles.copySqlBtnText}>Copy Setup SQL Query</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* ── APK BUILD & DISTRIBUTION TAB ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Package size={18} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>CLIENT APK BUILD & DISTRIBUTION</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Generate standalone, white-labeled Android release APKs for your client gym. Baked with custom branding, app identity, and Supabase credentials.
              </Text>

              {/* Status & Output Path */}
              <View style={styles.buildOutputCard}>
                <View style={styles.buildOutputHeader}>
                  <Text style={styles.buildOutputLabel}>STANDALONE RELEASE APK OUTPUT</Text>
                  <FVEBadge
                    label="GRADLE RELEASE"
                    color={colors.gold}
                    bgColor={colors.goldMuted}
                    borderColor={colors.goldBorder}
                    size="sm"
                  />
                </View>
                <Text numberOfLines={2} style={styles.buildOutputPath}>
                  fve-mobile/android/app/build/outputs/apk/release/app-release.apk
                </Text>
                <TouchableOpacity onPress={handleCopyApkPath} style={styles.copyPathBtn}>
                  <Copy size={13} color={colors.gold} style={{ marginRight: 5 }} />
                  <Text style={styles.copyPathBtnText}>Copy File Path</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── ARCHITECTURE NOTICE: RUNTIME SWITCH VS COMPILED APK ── */}
            <View style={styles.noticeCard}>
              <View style={styles.noticeHeader}>
                <Info size={16} color={colors.blue} style={{ marginRight: 6 }} />
                <Text style={styles.noticeTitle}>RUNTIME SWITCH VS COMPILED APK</Text>
              </View>
              <Text style={styles.noticeBody}>
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>💡 Good News:</Text> You rarely need to re-compile an APK! If you only want this phone to connect to the client's database with their custom colors and logo, switch directly in the <Text style={{ fontWeight: '700', color: colors.gold }}>Supabase Switcher</Text> tab. The app adapts dynamically at runtime.
              </Text>
              <Text style={[styles.noticeBody, { marginTop: 8 }]}>
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>When to compile an APK:</Text> Only when the client requires a completely isolated standalone app with their own package name (<Text style={{ fontFamily: typography.fonts.rajdhani, color: colors.gold }}>com.clientgym.app</Text>), custom launcher icon on Google Play, or pre-baked credentials for offline install.
              </Text>
            </View>

            {/* ── BUILD COMMANDS (TERMINAL READY) ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Terminal size={16} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>CLI COMPILATION PIPELINES</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Run these commands from your computer terminal in the project root to compile the release APK:
              </Text>

              {/* Command 1: Fast Build */}
              <View style={styles.commandCard}>
                <View style={styles.commandHeader}>
                  <Text style={styles.commandTitle}>1. Local Release APK (Recommended)</Text>
                  <TouchableOpacity
                    onPress={() => handleCopyCommand('cd fve-mobile && npm run build:apk', 'local')}
                    style={styles.copyCommandBtn}
                  >
                    <Copy size={13} color="#050505" style={{ marginRight: 4 }} />
                    <Text style={styles.copyCommandBtnText}>
                      {copiedCommand === 'local' ? 'COPIED!' : 'COPY'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.commandDesc}>
                  Compiles an optimized, signed release APK using local Java 17 and Gradle daemon.
                </Text>
                <View style={styles.commandSnippetBox}>
                  <Text style={styles.commandSnippet}>cd fve-mobile && npm run build:apk</Text>
                </View>
              </View>

              {/* Command 2: Clean Rebuild */}
              <View style={styles.commandCard}>
                <View style={styles.commandHeader}>
                  <Text style={styles.commandTitle}>2. Clean Rebuild (Clear Cache)</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopyCommand(
                        'cd fve-mobile/android && ./gradlew clean && cd .. && npm run build:apk',
                        'clean'
                      )
                    }
                    style={styles.copyCommandBtn}
                  >
                    <Copy size={13} color="#050505" style={{ marginRight: 4 }} />
                    <Text style={styles.copyCommandBtnText}>
                      {copiedCommand === 'clean' ? 'COPIED!' : 'COPY'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.commandDesc}>
                  Purges stale Gradle build artifacts when changing .env credentials or native assets.
                </Text>
                <View style={styles.commandSnippetBox}>
                  <Text style={styles.commandSnippet}>
                    cd fve-mobile/android && ./gradlew clean && cd .. && npm run build:apk
                  </Text>
                </View>
              </View>

              {/* Command 3: Cloud EAS Build */}
              <View style={styles.commandCard}>
                <View style={styles.commandHeader}>
                  <Text style={styles.commandTitle}>3. Cloud EAS Build (No Android SDK Required)</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopyCommand(
                        'cd fve-mobile && npx eas build -p android --profile production',
                        'eas'
                      )
                    }
                    style={styles.copyCommandBtn}
                  >
                    <Copy size={13} color="#050505" style={{ marginRight: 4 }} />
                    <Text style={styles.copyCommandBtnText}>
                      {copiedCommand === 'eas' ? 'COPIED!' : 'COPY'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.commandDesc}>
                  Builds on Expo Cloud infrastructure and provides a direct APK download link.
                </Text>
                <View style={styles.commandSnippetBox}>
                  <Text style={styles.commandSnippet}>
                    cd fve-mobile && npx eas build -p android --profile production
                  </Text>
                </View>
              </View>
            </View>

            {/* ── CLIENT .ENV GENERATOR ── */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeaderRow}>
                <Smartphone size={16} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>CLIENT .ENV PREPARATION</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Mobile APKs bake environment variables at compile time. Ensure <Text style={{ fontFamily: typography.fonts.rajdhani, color: colors.gold }}>fve-mobile/.env</Text> contains the client credentials below before running the build:
              </Text>

              <View style={styles.envSnippetBox}>
                <Text style={styles.envSnippetText}>
                  {`EXPO_PUBLIC_SUPABASE_URL=${supabaseConfig.url || 'https://your-project.supabase.co'}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${supabaseConfig.anonKey || 'your-anon-key'}\nEXPO_PUBLIC_SUPABASE_KEY=${supabaseConfig.anonKey || 'your-anon-key'}`}
                </Text>
              </View>

              <TouchableOpacity onPress={handleCopyEnvConfig} style={styles.copySqlBtn}>
                <Copy size={15} color="#050505" style={{ marginRight: 6 }} />
                <Text style={styles.copySqlBtnText}>Copy Client .env Snippet</Text>
              </TouchableOpacity>
            </View>

            {/* ── 4-STEP RELEASE CHECKLIST ── */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>RELEASE DEPLOYMENT CHECKLIST</Text>
              <Text style={styles.sectionSubtitle}>
                Follow these 4 steps to produce a verified client production build:
              </Text>

              <View style={styles.checklistItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Configure Database & Branding</Text>
                  <Text style={styles.stepDesc}>
                    In Supabase Switcher, test and verify database connection. In Brand & Theme, configure colors and logo.
                  </Text>
                </View>
              </View>

              <View style={styles.checklistItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Update fve-mobile/.env & app.json</Text>
                  <Text style={styles.stepDesc}>
                    Copy the client .env snippet above into fve-mobile/.env. Optionally update package name in app.json.
                  </Text>
                </View>
              </View>

              <View style={styles.checklistItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Compile Standalone APK</Text>
                  <Text style={styles.stepDesc}>
                    Open terminal on your computer, navigate to fve-mobile, and run `npm run build:apk`.
                  </Text>
                </View>
              </View>

              <View style={styles.checklistItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Distribute to Gym Staff & Members</Text>
                  <Text style={styles.stepDesc}>
                    Locate the generated app-release.apk and transfer via Google Drive, WhatsApp, or direct USB sideload.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </FVEKeyboardAwareContainer>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#080A0D' : colors.cardBackground,
      padding: 6,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
    },
    tabButtonActive: {
      backgroundColor: colors.gold,
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 2,
    },
    tabButtonText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    tabButtonTextActive: {
      color: '#050505',
    },
    customDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.blue,
      marginLeft: 6,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 120,
    },
    cardSection: {
      backgroundColor: isDark ? colors.cardBackground : colors.cardBackground,
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    sectionTitle: {
      fontFamily: typography.fonts.orbitron,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 16,
      marginTop: 2,
      lineHeight: 17,
    },
    previewModeToggle: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    },
    previewModeText: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 11,
      color: colors.textPrimary,
    },
    mockupFrame: {
      borderRadius: 16,
      borderWidth: 1.5,
      padding: 14,
      overflow: 'hidden',
    },
    mockupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    mockupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    mockupLogo: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 10,
    },
    mockupLogoPlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    mockupLogoInitial: {
      fontFamily: typography.fonts.orbitron,
      fontSize: 14,
      fontWeight: '900',
    },
    mockupGymTitle: {
      fontFamily: typography.fonts.orbitron,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    mockupGymSlogan: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 9,
      letterSpacing: 0.5,
      marginTop: 1,
    },
    mockupBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    mockupBadgeText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 10,
      fontWeight: '700',
    },
    mockupCard: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    mockupCardLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    mockupCardValue: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
    },
    mockupProgressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(128, 128, 128, 0.2)',
      overflow: 'hidden',
    },
    mockupProgressBar: {
      height: '100%',
      borderRadius: 3,
    },
    mockupButton: {
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mockupButtonText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
    },
    inputLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: isDark ? '#080A0D' : '#F1F4F8',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: typography.fonts.inter,
      fontSize: 13,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
      marginBottom: 14,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoPreviewBox: {
      width: 72,
      height: 72,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: isDark ? colors.goldBorder : colors.borderDark,
      backgroundColor: isDark ? '#080A0D' : '#F1F4F8',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      overflow: 'hidden',
    },
    logoPreviewImage: {
      width: '100%',
      height: '100%',
    },
    logoActions: {
      flex: 1,
      gap: 8,
    },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.gold,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    uploadBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: '#050505',
    },
    removeLogoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    removeLogoBtnText: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 12,
      color: colors.error,
    },
    presetsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    presetCard: {
      width: '48%',
      backgroundColor: isDark ? '#0A0D11' : '#F8FAFC',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)',
    },
    presetCardActive: {
      borderColor: colors.gold,
      backgroundColor: isDark ? '#141820' : '#FFFFFF',
    },
    presetTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    presetSwatches: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    swatchDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: '#050505',
    },
    presetCheckPill: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetName: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    presetTagline: {
      fontFamily: typography.fonts.inter,
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 14,
    },
    hexInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    colorPreviewChip: {
      width: 38,
      height: 38,
      borderRadius: 8,
      marginRight: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    quickSwatchesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
    },
    quickSwatchCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    quickSwatchCircleActive: {
      borderColor: '#FFFFFF',
      borderWidth: 2.5,
      transform: [{ scale: 1.15 }],
    },
    actionsContainer: {
      marginTop: 4,
      marginBottom: 16,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
      paddingVertical: 10,
    },
    resetBtnText: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 12,
      color: colors.textMuted,
    },
    connectionCard: {
      backgroundColor: isDark ? '#080A0D' : '#F1F4F8',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1.5,
    },
    connectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    connectionBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    connectionStatusTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    connectionUrlLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 2,
    },
    connectionUrlValue: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textSecondary,
    },
    revertEnvBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    },
    revertEnvBtnText: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 12,
      color: colors.gold,
    },
    clientFormActions: {
      marginTop: 4,
    },
    testConnectionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.goldBorder,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.08)' : 'rgba(217, 130, 0, 0.08)',
    },
    testConnectionBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.gold,
    },
    testResultBox: {
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    testResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    testResultText: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 12,
      flex: 1,
    },
    profileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#080A0D' : '#F1F4F8',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)',
    },
    profileName: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    profileUrl: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    switchProfileBtn: {
      backgroundColor: colors.gold,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginRight: 8,
    },
    switchProfileBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      color: '#050505',
    },
    deleteProfileBtn: {
      padding: 6,
    },
    copySqlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.gold,
      paddingVertical: 12,
      borderRadius: 10,
    },
    copySqlBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: '#050505',
    },
    buildOutputCard: {
      backgroundColor: isDark ? '#080A0D' : colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.2)' : 'rgba(15, 23, 42, 0.08)',
      marginTop: 4,
    },
    buildOutputHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    buildOutputLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    buildOutputPath: {
      fontFamily: typography.fonts.interMedium,
      fontSize: 12,
      color: colors.gold,
      marginVertical: 8,
      lineHeight: 18,
    },
    copyPathBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    copyPathBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.gold,
    },
    noticeCard: {
      backgroundColor: 'rgba(0, 102, 255, 0.08)',
      borderColor: 'rgba(0, 102, 255, 0.25)',
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
    },
    noticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    noticeTitle: {
      fontFamily: typography.fonts.orbitron,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.blue,
    },
    noticeBody: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    commandCard: {
      backgroundColor: isDark ? '#0A0D12' : colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
      padding: 14,
      marginBottom: 12,
    },
    commandHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    commandTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    copyCommandBtn: {
      backgroundColor: colors.gold,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      marginLeft: 8,
    },
    copyCommandBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 10,
      fontWeight: '800',
      color: '#050505',
      letterSpacing: 0.5,
    },
    commandDesc: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 8,
      lineHeight: 16,
    },
    commandSnippetBox: {
      backgroundColor: '#030405',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    commandSnippet: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      color: colors.gold,
      fontWeight: '700',
    },
    envSnippetBox: {
      backgroundColor: '#030405',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239, 161, 0, 0.25)',
      marginBottom: 12,
    },
    envSnippetText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 11,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    checklistItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    stepBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      marginTop: 2,
    },
    stepBadgeText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '800',
      color: colors.gold,
    },
    stepTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    stepDesc: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
  });
