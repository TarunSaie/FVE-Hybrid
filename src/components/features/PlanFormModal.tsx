import React, { useState, useEffect, useRef } from 'react';
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
  const nameRef = useRef('');
  const priceRef = useRef('');
  const durationDaysRef = useRef('30');
  const [durationType, setDurationType] = useState('MONTHLY');
  const visitLimitRef = useRef('');
  const featuresRef = useRef('');

  useEffect(() => {
    if (plan) {
      nameRef.current = plan.name || '';
      priceRef.current = plan.price ? String(plan.price) : '';
      durationDaysRef.current = plan.duration_days ? String(plan.duration_days) : '30';
      setDurationType(plan.duration_type || 'MONTHLY');
      visitLimitRef.current = plan.visit_day_limit ? String(plan.visit_day_limit) : '';
      featuresRef.current = Array.isArray(plan.features) ? plan.features.join(', ') : '';
    } else {
      nameRef.current = '';
      priceRef.current = '';
      durationDaysRef.current = '30';
      setDurationType('MONTHLY');
      visitLimitRef.current = '';
      featuresRef.current = '';
    }
  }, [plan, visible]);

  const handleSave = async () => {
    if (!nameRef.current.trim()) return Alert.alert('Error', 'Plan name is required');
    if (!priceRef.current || isNaN(Number(priceRef.current))) return Alert.alert('Error', 'Valid plan price is required');

    setLoading(true);
    try {
      const featuresArray = featuresRef.current
        ? featuresRef.current.split(',').map(f => f.trim()).filter(Boolean)
        : [];

      const payload = {
        name: nameRef.current.trim(),
        price: Number(priceRef.current),
        duration_days: parseInt(durationDaysRef.current, 10) || 30,
        duration_type: durationType,
        visit_day_limit: visitLimitRef.current ? parseInt(visitLimitRef.current, 10) : null,
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
          defaultValue={nameRef.current}
          onChangeText={(t) => { nameRef.current = t; }}
          placeholder="e.g. Gold Monthly, Annual Elite"
        />

        <FVEInput
          label="PRICE (INR) *"
          defaultValue={priceRef.current}
          onChangeText={(t) => { priceRef.current = t; }}
          placeholder="e.g. 2500"
          keyboardType="numeric"
        />

        <FVEInput
          label="VALIDITY DURATION (DAYS) *"
          defaultValue={durationDaysRef.current}
          onChangeText={(t) => { durationDaysRef.current = t; }}
          placeholder="e.g. 30, 90, 365"
          keyboardType="numeric"
        />

        <FVEInput
          label="MAX USABLE VISIT DAYS (OPTIONAL)"
          defaultValue={visitLimitRef.current}
          onChangeText={(t) => { visitLimitRef.current = t; }}
          placeholder="Leave blank for unlimited visits"
          keyboardType="numeric"
        />

        <FVEInput
          label="PLAN FEATURES (COMMA-SEPARATED)"
          defaultValue={featuresRef.current}
          onChangeText={(t) => { featuresRef.current = t; }}
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
