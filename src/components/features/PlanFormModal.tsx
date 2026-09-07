import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Plus, Trash2, Calendar, Check, Sparkles } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { MembershipPlan } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { parseFeatures } from '@/utils/format';
import { haptics } from '@/utils/haptics';

interface PlanFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan?: MembershipPlan | null;
}

export const DURATION_PRESETS = [
  { label: 'Monthly (30 days)', type: 'MONTHLY', days: 30 },
  { label: 'Quarterly (90 days)', type: 'QUARTERLY', days: 90 },
  { label: 'Half Yearly (180 days)', type: 'HALF_YEARLY', days: 180 },
  { label: 'Yearly (365 days)', type: 'YEARLY', days: 365 },
  { label: 'Custom', type: 'CUSTOM', days: 0 },
];

export function PlanFormModal({
  visible,
  onClose,
  onSaved,
  plan,
}: PlanFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationType, setDurationType] = useState('MONTHLY');
  const [durationDays, setDurationDays] = useState('30');
  const [visitDayLimit, setVisitDayLimit] = useState('');
  const [features, setFeatures] = useState<string[]>(['']);

  useEffect(() => {
    if (visible) {
      if (plan) {
        setName(plan.name || '');
        setPrice(plan.price ? String(plan.price) : '');
        setDurationType(plan.duration_type || 'MONTHLY');
        setDurationDays(plan.duration_days ? String(plan.duration_days) : '30');
        setVisitDayLimit(plan.visit_day_limit ? String(plan.visit_day_limit) : '');
        const parsed = parseFeatures(plan.features);
        setFeatures(parsed.length > 0 ? parsed : ['']);
      } else {
        setName('');
        setPrice('');
        setDurationType('MONTHLY');
        setDurationDays('30');
        setVisitDayLimit('');
        setFeatures(['']);
      }
    }
  }, [plan, visible]);

  const handleDurationPreset = (type: string, days: number) => {
    haptics.selection();
    setDurationType(type);
    if (days > 0) {
      setDurationDays(String(days));
    }
  };

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
      return Alert.alert('Validation Error', 'Please enter a valid plan name.');
    }
    const parsedPrice = parseFloat(price.trim());
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      haptics.warning();
      return Alert.alert('Validation Error', 'Please enter a valid plan price.');
    }
    const parsedDays = parseInt(durationDays.trim(), 10);
    if (isNaN(parsedDays) || parsedDays <= 0) {
      haptics.warning();
      return Alert.alert('Validation Error', 'Please enter a valid duration in days (minimum 1 day).');
    }

    setLoading(true);
    try {
      const cleanFeatures = features.map(f => f.trim()).filter(Boolean);

      const payload: Record<string, unknown> = {
        name: name.trim(),
        price: parsedPrice,
        duration_type: durationType,
        duration_days: parsedDays,
        visit_day_limit: visitDayLimit.trim() ? parseInt(visitDayLimit.trim(), 10) : null,
        features: JSON.stringify(cleanFeatures),
      };

      // Only force active: true on creation — preserve archived state when editing
      if (!plan) {
        payload.active = true;
      }

      if (plan) {
        const { error } = await supabase
          .from('membership_plans')
          .update(payload)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('membership_plans')
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      haptics.success();
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to save membership plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={plan ? 'EDIT MEMBERSHIP PLAN' : 'CREATE MEMBERSHIP PLAN'}
      subtitle="Configure gym subscription tiers & features"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plan Name */}
        <FVEInput
          label="PLAN NAME *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Strength + Cardio, Elite Annual"
        />

        {/* Price */}
        <FVEInput
          label="PRICE (INR) *"
          value={price}
          onChangeText={setPrice}
          placeholder="e.g. 2999"
          keyboardType="numeric"
        />

        {/* Duration Presets */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>DURATION</Text>
          <View style={styles.presetsGrid}>
            {DURATION_PRESETS.map(p => {
              const isSelected = durationType === p.type;
              return (
                <TouchableOpacity
                  key={p.type}
                  onPress={() => handleDurationPreset(p.type, p.days)}
                  style={[
                    styles.presetButton,
                    isSelected && styles.presetButtonActive,
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      isSelected && styles.presetButtonTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Duration Days Input */}
          {durationType === 'CUSTOM' && (
            <View style={styles.customDurationContainer}>
              <FVEInput
                label="CUSTOM DURATION (DAYS) *"
                value={durationDays}
                onChangeText={setDurationDays}
                placeholder="e.g. 45, 100, 200"
                keyboardType="numeric"
                containerStyle={{ marginBottom: 0 }}
              />
              <Text style={styles.helperText}>
                Enter the exact number of access days for this custom tier.
              </Text>
            </View>
          )}
        </View>

        {/* Max Usable Visit Days (Optional) */}
        <View style={styles.sectionContainer}>
          <FVEInput
            label="MAX USABLE VISIT DAYS (OPTIONAL)"
            value={visitDayLimit}
            onChangeText={setVisitDayLimit}
            placeholder="e.g. 30 visit days within validity"
            keyboardType="numeric"
            containerStyle={{ marginBottom: 4 }}
          />
          <Text style={styles.helperText}>
            Member can check in this many days total during validity. Leave blank for unlimited visits.
          </Text>
        </View>

        {/* Features Manager */}
        <View style={styles.sectionContainer}>
          <View style={styles.featuresHeader}>
            <View style={styles.featuresLabelRow}>
              <Sparkles size={14} color={colors.gold} style={{ marginRight: 6 }} />
              <Text style={styles.sectionLabel}>PLAN FEATURES</Text>
            </View>
            <TouchableOpacity
              onPress={addFeature}
              style={styles.addFeatureBtn}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.gold} />
              <Text style={styles.addFeatureText}>Add Feature</Text>
            </TouchableOpacity>
          </View>

          {features.map((feat, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureInputWrap}>
                <FVEInput
                  value={feat}
                  onChangeText={(t) => updateFeature(index, t)}
                  placeholder={`Feature ${index + 1} (e.g. Steam Bath, Personal Locker)`}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              {features.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeFeature(index)}
                  style={styles.removeFeatureBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Action Button */}
        <FVEButton
          title={plan ? 'UPDATE PLAN' : 'CREATE PLAN'}
          onPress={handleSave}
          loading={loading}
          variant="gold"
          size="lg"
          style={styles.saveButton}
        />
      </ScrollView>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingBottom: 24,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#12161B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetButtonActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  presetButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  presetButtonTextActive: {
    color: '#050505',
    fontWeight: '700',
  },
  customDurationContainer: {
    marginTop: 10,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  featuresLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFeatureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addFeatureText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featureInputWrap: {
    flex: 1,
  },
  removeFeatureBtn: {
    width: 38,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.25)',
  },
  saveButton: {
    marginTop: 14,
  },
});
