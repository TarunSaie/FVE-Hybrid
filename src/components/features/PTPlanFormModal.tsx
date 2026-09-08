import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Plus, Trash2, Calendar, Dumbbell, Sparkles } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { PersonalTrainingPlan } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { parseFeatures } from '@/utils/format';
import { haptics } from '@/utils/haptics';

interface PTPlanFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan?: PersonalTrainingPlan | null;
}

const SESSION_PRESETS = [8, 12, 16, 24, 36, 48];
const DURATION_PRESETS = [
  { label: '30 Days', days: 30 },
  { label: '45 Days', days: 45 },
  { label: '60 Days', days: 60 },
  { label: '90 Days', days: 90 },
  { label: '120 Days', days: 120 },
];

export function PTPlanFormModal({
  visible,
  onClose,
  onSaved,
  plan,
}: PTPlanFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [totalSessions, setTotalSessions] = useState('12');
  const [durationDays, setDurationDays] = useState('45');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState<string[]>([
    'Dedicated 1-on-1 Certified Personal Trainer',
    'Customized Progressive Workout Routine',
    'Form & Posture Correction Assessment',
    'Dietary Guidelines & Nutrition Advice',
  ]);

  useEffect(() => {
    if (visible) {
      if (plan) {
        setName(plan.name || '');
        setTotalSessions(plan.total_sessions ? String(plan.total_sessions) : '12');
        setDurationDays(plan.duration_days ? String(plan.duration_days) : '45');
        setPrice(plan.price ? String(plan.price) : '');
        setDescription(plan.description || '');
        const parsed = parseFeatures(plan.features);
        setFeatures(parsed.length > 0 ? parsed : ['']);
      } else {
        setName('');
        setTotalSessions('12');
        setDurationDays('45');
        setPrice('');
        setDescription('');
        setFeatures([
          'Dedicated 1-on-1 Certified Personal Trainer',
          'Customized Progressive Workout Routine',
          'Form & Posture Correction Assessment',
          'Dietary Guidelines & Nutrition Advice',
        ]);
      }
    }
  }, [plan, visible]);

  const addFeature = () => {
    haptics.light();
    setFeatures(prev => [...prev, '']);
  };

  const removeFeature = (index: number) => {
    haptics.light();
    setFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const updateFeature = (index: number, text: string) => {
    setFeatures(prev => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      haptics.warning();
      return Alert.alert('Validation Error', 'Please enter a valid PT package name.');
    }
    const parsedSessions = parseInt(totalSessions.trim(), 10);
    if (isNaN(parsedSessions) || parsedSessions <= 0) {
      haptics.warning();
      return Alert.alert('Validation Error', 'Please enter a valid session count (minimum 1 session).');
    }
    const parsedDays = parseInt(durationDays.trim(), 10);
    if (isNaN(parsedDays) || parsedDays <= 0) {
      haptics.warning();
      return Alert.alert('Validation Error', 'Please enter a valid validity duration (minimum 1 day).');
    }
    const parsedPrice = parseFloat(price.trim());
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      haptics.warning();
      return Alert.alert('Validation Error', 'Please enter a valid package fee in Rupees.');
    }

    setLoading(true);
    try {
      const cleanFeatures = features.map(f => f.trim()).filter(Boolean);

      const payload: Record<string, unknown> = {
        name: name.trim(),
        total_sessions: parsedSessions,
        duration_days: parsedDays,
        price: String(parsedPrice),
        description: description.trim(),
        features: JSON.stringify(cleanFeatures),
        updated_at: new Date().toISOString(),
      };

      if (!plan) {
        payload.active = true;
      }

      if (plan) {
        const { error } = await supabase
          .from('personal_training_plans')
          .update(payload)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('personal_training_plans')
          .insert(payload);
        if (error) throw error;
      }

      haptics.success();
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.warning();
      Alert.alert('Error', (err as Error).message || 'Failed to save PT plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={plan ? 'EDIT PT PACKAGE' : 'NEW PT PACKAGE'}
      subtitle="Define personal training packages & pricing"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plan Name */}
        <FVEInput
          label="PACKAGE NAME *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. 24 Sessions — Transformation Pro"
        />

        {/* Sessions & Presets */}
        <View style={styles.section}>
          <Text style={styles.label}>TOTAL SESSIONS *</Text>
          <FVEInput
            value={totalSessions}
            onChangeText={setTotalSessions}
            keyboardType="number-pad"
            placeholder="12"
          />
          <View style={styles.presetRow}>
            {SESSION_PRESETS.map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  haptics.selection();
                  setTotalSessions(String(s));
                }}
                style={[
                  styles.presetChip,
                  totalSessions === String(s) && styles.presetChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    totalSessions === String(s) && styles.presetTextActive,
                  ]}
                >
                  {s} SESS
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Validity Duration & Presets */}
        <View style={styles.section}>
          <Text style={styles.label}>VALIDITY DURATION (DAYS) *</Text>
          <FVEInput
            value={durationDays}
            onChangeText={setDurationDays}
            keyboardType="number-pad"
            placeholder="45"
          />
          <View style={styles.presetRow}>
            {DURATION_PRESETS.map(d => (
              <TouchableOpacity
                key={d.days}
                onPress={() => {
                  haptics.selection();
                  setDurationDays(String(d.days));
                }}
                style={[
                  styles.presetChip,
                  durationDays === String(d.days) && styles.presetChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    durationDays === String(d.days) && styles.presetTextActive,
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Price */}
        <View style={styles.section}>
          <FVEInput
            label="PACKAGE FEE (₹) *"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="e.g. 6000"
          />
          {price && Number(price) > 0 && Number(totalSessions) > 0 && (
            <Text style={styles.perSessionText}>
              ≈ ₹{Math.round(Number(price) / Number(totalSessions))} per session
            </Text>
          )}
        </View>

        {/* Description */}
        <FVEInput
          label="DESCRIPTION (OPTIONAL)"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Target fitness goals, routine, or training level"
          multiline
          numberOfLines={2}
        />

        {/* Features / Perks */}
        <View style={styles.section}>
          <View style={styles.featuresHeader}>
            <Text style={styles.label}>PACKAGE PERKS & HIGHLIGHTS</Text>
            <TouchableOpacity onPress={addFeature} style={styles.addFeatureBtn}>
              <Plus size={14} color={colors.gold} />
              <Text style={styles.addFeatureText}>ADD PERK</Text>
            </TouchableOpacity>
          </View>

          {features.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={styles.featureInputWrapper}>
                <FVEInput
                  value={feature}
                  onChangeText={text => updateFeature(idx, text)}
                  placeholder={`Perk ${idx + 1}`}
                />
              </View>
              {features.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeFeature(idx)}
                  style={styles.removeFeatureBtn}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Action Button */}
        <View style={styles.actions}>
          <FVEButton
            title={plan ? 'UPDATE PT PACKAGE' : 'CREATE PT PACKAGE'}
            onPress={handleSave}
            loading={loading}
          />
        </View>
      </ScrollView>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
    gap: 12,
  },
  section: {
    marginBottom: 4,
  },
  label: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  presetText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  presetTextActive: {
    color: colors.background,
  },
  perSessionText: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
    color: colors.gold,
    marginTop: 4,
  },
  featuresHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addFeatureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addFeatureText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  featureInputWrapper: {
    flex: 1,
  },
  removeFeatureBtn: {
    padding: 8,
  },
  actions: {
    marginTop: 12,
  },
});
