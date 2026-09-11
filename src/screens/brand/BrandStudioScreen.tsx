import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette, RefreshCcw, Save, Upload } from 'lucide-react-native';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEHeader } from '@/components/common/FVEHeader';
import { DEFAULT_BRAND_CONFIG, useBranding } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessBrandStudio } from '@/constants/permissions';

const fallbackLogo = require('@/../assets/logo.png');

function resolveImageSource(url?: string): { uri: string } | number {
  if (url && url.trim().length > 0) {
    return { uri: url };
  }
  return fallbackLogo;
}

export function BrandStudioScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { brandConfig, saveBranding } = useBranding();
  const [draft, setDraft] = useState(brandConfig);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo_url' | 'favicon_url' | null>(null);

  useEffect(() => {
    setDraft(brandConfig);
  }, [brandConfig]);

  const styles = useMemo(() => getBrandStudioStyles(colors, isDark), [colors, isDark]);

  const updateField = (field: keyof typeof draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpload = async (field: 'logo_url' | 'favicon_url') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Media permission required', 'Please allow access to your photos to upload a gym logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const extension = (asset.mimeType || 'image/png').split('/').pop() || 'png';
    const targetName = `${field}-${Date.now()}.${extension}`;
    const path = `brand-assets/${targetName}`;

    try {
      setUploading(field);
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('gym-branding')
        .upload(path, blob, {
          contentType: asset.mimeType || 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('gym-branding').getPublicUrl(path);

      if (!data?.publicUrl) {
        throw new Error('Unable to generate the public URL for the uploaded image.');
      }

      setDraft((prev) => ({ ...prev, [field]: data.publicUrl }));
    } catch (error: unknown) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await saveBranding(draft);
      if (error) throw error;
      Alert.alert('Brand updated', 'Your gym branding has been saved successfully.');
    } catch (error: unknown) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(DEFAULT_BRAND_CONFIG);
  };

  const swatches = ['#EFA100', '#0066FF', '#A855F7', '#10B981', '#F97316', '#EC4899'];

  if (!canAccessBrandStudio(user?.role, user?.email)) {
    return (
      <View style={styles.container}>
        <FVEHeader title="ACCESS RESTRICTED" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Brand Studio is restricted to Chirvex staff.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FVEHeader title="BRAND STUDIO" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDark ? ['rgba(239,161,0,0.18)', 'rgba(239,161,0,0.03)', 'transparent'] : ['rgba(239,161,0,0.12)', 'rgba(239,161,0,0.04)', 'transparent']}
          style={styles.heroGlow}
          pointerEvents="none"
        />

        <View style={styles.previewCard}>
          <View style={styles.previewHeaderRow}>
            <Palette size={16} color={colors.gold} />
            <Text style={styles.sectionTitle}>Live Preview</Text>
          </View>

          <View style={styles.previewBody}>
            <Image source={resolveImageSource(draft.logo_url)} style={styles.previewLogo} resizeMode="contain" />
            <View style={styles.previewTextWrap}>
              <Text style={[styles.previewGymName, { color: draft.primary_color }]}>{draft.gym_name}</Text>
              <Text style={[styles.previewTagline, { color: colors.textMuted }]}>{draft.slogan}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gym Identity</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Gym Name</Text>
            <TextInput
              value={draft.gym_name}
              onChangeText={(value) => updateField('gym_name', value)}
              style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.borderDark, backgroundColor: isDark ? colors.bgSecondary : colors.surfaceLight }]}
              placeholder="Enter gym name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Slogan</Text>
            <TextInput
              value={draft.slogan}
              onChangeText={(value) => updateField('slogan', value)}
              style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.borderDark, backgroundColor: isDark ? colors.bgSecondary : colors.surfaceLight }]}
              placeholder="Discipline • Strength • Transformation"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Logo</Text>
            <View style={styles.uploadRow}>
              <Image source={resolveImageSource(draft.logo_url)} style={styles.logoThumb} resizeMode="contain" />
              <FVEButton
                title={uploading === 'logo_url' ? 'Uploading...' : 'Upload Logo'}
                variant="secondary"
                size="sm"
                onPress={() => handleUpload('logo_url')}
                disabled={!!uploading}
                icon={<Upload size={14} color={colors.gold} />}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Favicon / Mobile Icon</Text>
            <View style={styles.uploadRow}>
              <Image source={resolveImageSource(draft.favicon_url)} style={styles.faviconThumb} resizeMode="contain" />
              <FVEButton
                title={uploading === 'favicon_url' ? 'Uploading...' : 'Upload Icon'}
                variant="secondary"
                size="sm"
                onPress={() => handleUpload('favicon_url')}
                disabled={!!uploading}
                icon={<Upload size={14} color={colors.gold} />}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Colors</Text>

          <View style={styles.colorGrid}>
            {swatches.map((swatch) => (
              <TouchableOpacity
                key={swatch}
                onPress={() => updateField('primary_color', swatch)}
                style={[styles.swatchButton, { backgroundColor: swatch }, draft.primary_color === swatch && styles.swatchSelected]}
                activeOpacity={0.9}
              />
            ))}
          </View>

          <View style={styles.colorFieldRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Primary</Text>
              <TextInput
                value={draft.primary_color}
                onChangeText={(value) => updateField('primary_color', value)}
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.borderDark, backgroundColor: isDark ? colors.bgSecondary : colors.surfaceLight }]}
                placeholder="#EFA100"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Secondary</Text>
              <TextInput
                value={draft.secondary_color}
                onChangeText={(value) => updateField('secondary_color', value)}
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.borderDark, backgroundColor: isDark ? colors.bgSecondary : colors.surfaceLight }]}
                placeholder="#0066FF"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.colorFieldRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Accent Text</Text>
              <TextInput
                value={draft.accent_text_color}
                onChangeText={(value) => updateField('accent_text_color', value)}
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.borderDark, backgroundColor: isDark ? colors.bgSecondary : colors.surfaceLight }]}
                placeholder="#050505"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Theme</Text>
              <TextInput
                value={draft.theme_mode}
                onChangeText={(value) => updateField('theme_mode', value)}
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.borderDark, backgroundColor: isDark ? colors.bgSecondary : colors.surfaceLight }]}
                placeholder="dark"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <FVEButton
            title="Reset"
            variant="secondary"
            size="md"
            onPress={handleReset}
            icon={<RefreshCcw size={16} color={colors.gold} />}
            style={styles.actionButton}
          />
          <FVEButton
            title="Save Changes"
            variant="gold"
            size="md"
            loading={saving}
            onPress={handleSave}
            icon={<Save size={16} color="#050505" />}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const getBrandStudioStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    heroGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 220,
    },
    previewCard: {
      backgroundColor: isDark ? colors.card : colors.cardBackground,
      borderColor: colors.borderDark,
      borderWidth: 1,
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    previewHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.md,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    previewBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    previewLogo: {
      width: 60,
      height: 60,
      borderRadius: 14,
      backgroundColor: isDark ? '#101418' : '#F5F5F5',
    },
    previewTextWrap: {
      flex: 1,
    },
    previewGymName: {
      fontSize: typography.sizes.lg,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '800',
      letterSpacing: 1,
    },
    previewTagline: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    card: {
      backgroundColor: isDark ? colors.card : colors.cardBackground,
      borderColor: colors.borderDark,
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
    },
    fieldGroup: {
      marginTop: 16,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.inter,
    },
    uploadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    logoThumb: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: isDark ? '#101418' : '#F5F5F5',
    },
    faviconThumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: isDark ? '#101418' : '#F5F5F5',
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
      marginBottom: 12,
    },
    swatchButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchSelected: {
      borderColor: colors.gold,
      shadowColor: colors.gold,
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 3,
    },
    colorFieldRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    halfField: {
      flex: 1,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
    },
  });
