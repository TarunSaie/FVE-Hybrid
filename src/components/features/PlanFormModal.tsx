import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { MembershipPlan } from '@/types';
import { supabase } from '@/api/supabase';

interface PlanFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan?: MembershipPlan | null;
}

export function PlanFormModal({
  visible,
  onClose,
  onSaved,
  plan,
}: PlanFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [durationType, setDurationType] = useState('MONTHLY');
  const [visitLimit, setVisitLimit] = useState('');
  const [features, setFeatures] = useState('');

  useEffect(() => {
    if (plan) {
      setName(plan.name || '');
      setPrice(plan.price ? String(plan.price) : '');
      setDurationDays(plan.duration_days ? String(plan.duration_days) : '30');
      setDurationType(plan.duration_type || 'MONTHLY');
      setVisitLimit(plan.visit_day_limit ? String(plan.visit_day_limit) : '');
      setFeatures(Array.isArray(plan.features) ? plan.features.join(', ') : '');
    } else {
      setName('');
      setPrice('');
      setDurationDays('30');
      setDurationType('MONTHLY');
      setVisitLimit('');
      setFeatures('');
    }
  }, [plan, visible]);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Plan name is required');
    if (!price || isNaN(Number(price))) return Alert.alert('Error', 'Valid plan price is required');

    setLoading(true);
    try {
      const featuresArray = features
        ? features.split(',').map(f => f.trim()).filter(Boolean)
        : [];

      const payload = {
        name: name.trim(),
        price: Number(price),
        duration_days: parseInt(durationDays, 10) || 30,
        duration_type: durationType,
        visit_day_limit: visitLimit ? parseInt(visitLimit, 10) : null,
        features: JSON.stringify(featuresArray),
        active: true,
      };

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

      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={plan ? 'Edit Membership Plan' : 'Create Membership Plan'}
      subtitle="Configure gym subscription plans"
    >
      <View style={styles.form}>
        <FVEInput
          label="PLAN NAME *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Gold Monthly, Annual Elite"
        />

        <FVEInput
          label="PRICE (INR) *"
          value={price}
          onChangeText={setPrice}
          placeholder="e.g. 2500"
          keyboardType="numeric"
        />

        <FVEInput
          label="VALIDITY DURATION (DAYS) *"
          value={durationDays}
          onChangeText={setDurationDays}
          placeholder="e.g. 30, 90, 365"
          keyboardType="numeric"
        />

        <FVEInput
          label="MAX USABLE VISIT DAYS (OPTIONAL)"
          value={visitLimit}
          onChangeText={setVisitLimit}
          placeholder="Leave blank for unlimited visits"
          keyboardType="numeric"
        />

        <FVEInput
          label="PLAN FEATURES (COMMA-SEPARATED)"
          value={features}
          onChangeText={setFeatures}
          placeholder="Gym Access, Steam Bath, Locker, Trainer"
          multiline
        />

        <FVEButton
          title={plan ? 'UPDATE PLAN' : 'CREATE PLAN'}
          onPress={handleSave}
          loading={loading}
          variant="gold"
          size="lg"
          style={styles.saveButton}
        />
      </View>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingBottom: 20,
  },
  saveButton: {
    marginTop: 10,
  },
});
