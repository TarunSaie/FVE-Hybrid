import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { PersonalTraining, UserProfile } from '@/types';
import { UserCheck } from 'lucide-react-native';

interface PTAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  pt: PersonalTraining;
}

export function PTAssignmentModal({
  visible,
  onClose,
  onSaved,
  pt,
}: PTAssignmentModalProps) {
  const [trainerId, setTrainerId] = useState<string>(pt.trainer_id || '');
  const [packageName, setPackageName] = useState<string>(pt.package_name || '12 Sessions — Strength & Form');
  const [sessions, setSessions] = useState<string>(String(pt.total_sessions || 12));
  const [price, setPrice] = useState<string>(String(pt.price || '6000'));
  const [notes, setNotes] = useState<string>(pt.notes || '');
  const [trainers, setTrainers] = useState<UserProfile[]>([]);
  const [ptPlans, setPtPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setTrainerId(pt.trainer_id || '');
      setPackageName(pt.package_name || '12 Sessions — Strength & Form');
      setSessions(String(pt.total_sessions || 12));
      setPrice(String(pt.price || '6000'));
      setNotes(pt.notes || '');
      fetchTrainers();
      fetchPTPlans();
    }
  }, [visible, pt]);

  const fetchTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'TRAINER')
        .order('full_name');
      if (!error && data) {
        setTrainers(data as UserProfile[]);
      }
    } catch {
      // Suppress
    }
  };

  const fetchPTPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('personal_training_plans')
        .select('*')
        .eq('active', true)
        .order('total_sessions', { ascending: true });
      if (!error && data) {
        setPtPlans(data);
      }
    } catch {
      // Suppress
    }
  };

  const handleSave = async () => {
    if (!trainerId) {
      haptics.warning();
      Alert.alert('Required', 'Please assign an available trainer');
      return;
    }
    const numSessions = parseInt(sessions, 10);
    if (isNaN(numSessions) || numSessions <= 0) {
      haptics.warning();
      Alert.alert('Required', 'Please enter a valid session count');
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      haptics.warning();
      Alert.alert('Required', 'Please specify a valid package fee');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('personal_training')
        .update({
          trainer_id: trainerId,
          package_name: packageName.trim(),
          total_sessions: numSessions,
          price: String(numPrice),
          notes: notes.trim(),
          status: 'PENDING_PAYMENT',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pt.id);

      if (error) throw error;

      // Broadcast Notification
      try {
        await supabase.from('notifications').insert({
          user_id: trainerId,
          title: 'Assigned as Personal Trainer',
          message: `You have been assigned as personal trainer for ${pt.members?.full_name || 'a member'} (${packageName}, ${numSessions} sessions).`,
          type: 'INFO',
        });
      } catch {
        // Suppress
      }

      haptics.success();
      Alert.alert('Success', 'Trainer assigned and package pricing configured! Ready for payment.');
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to assign trainer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="ASSIGN TRAINER & PRICING"
      subtitle={`Member: ${pt.members?.full_name || 'Member'}`}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Goals Info */}
        {pt.special_goals ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>MEMBER GOALS & PREFERENCES:</Text>
            <Text style={styles.infoBoxText}>{pt.special_goals}</Text>
          </View>
        ) : null}

        {/* Trainer Selection */}
        <Text style={styles.fieldLabel}>ASSIGN AVAILABLE TRAINER *</Text>
        <View style={styles.trainersList}>
          {trainers.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              No trainers registered in system.
            </Text>
          ) : (
            trainers.map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  haptics.selection();
                  setTrainerId(t.id);
                }}
                style={[
                  styles.trainerCard,
                  trainerId === t.id && styles.trainerCardActive,
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.trainerIconBox}>
                  <UserCheck size={18} color={trainerId === t.id ? '#A855F7' : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trainerName, trainerId === t.id && { color: '#E9D5FF' }]}>
                    {t.full_name || t.username}
                  </Text>
                  {t.phone ? (
                    <Text style={styles.trainerPhone}>{t.phone}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Package Autofill Presets from Owner Plans */}
        {ptPlans.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={styles.fieldLabel}>AUTOFILL FROM OWNER PT PACKAGE</Text>
              <Text style={{ fontSize: 10, color: colors.gold, fontFamily: typography.fonts.rajdhani }}>1-TAP AUTOFILL</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ptPlans.map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    haptics.selection();
                    setPackageName(p.name);
                    setSessions(String(p.total_sessions));
                    setPrice(String(p.price));
                  }}
                  style={{
                    backgroundColor: packageName === p.name ? colors.goldMuted : colors.cardBackground,
                    borderWidth: 1,
                    borderColor: packageName === p.name ? colors.gold : colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: typography.fonts.rajdhani }}>
                    {p.name}
                  </Text>
                  <Text style={{ color: colors.gold, fontSize: 10, fontFamily: typography.fonts.inter, marginTop: 2 }}>
                    {p.total_sessions} Sess · ₹{p.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Package Title */}
        <FVEInput
          label="PACKAGE TITLE *"
          value={packageName}
          onChangeText={setPackageName}
          placeholder="e.g. 12 Sessions — Strength & Form"
          containerStyle={{ marginTop: 12 }}
        />

        {/* Sessions & Price Grid */}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}>
            <FVEInput
              label="TOTAL SESSIONS *"
              value={sessions}
              onChangeText={setSessions}
              keyboardType="numeric"
              placeholder="12"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FVEInput
              label="TOTAL PRICE (₹) *"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="6000"
            />
          </View>
        </View>

        {/* Notes */}
        <FVEInput
          label="ADMIN / PRICING NOTES"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Approved special discount or payment terms"
          multiline
          numberOfLines={2}
          containerStyle={{ marginTop: 12 }}
        />

        {/* Save Button */}
        <FVEButton
          title="SET PRICING & PROCEED"
          onPress={handleSave}
          loading={loading}
          variant="gold"
          size="lg"
          style={{ marginTop: 20, marginBottom: 10 }}
        />
      </ScrollView>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  infoBoxTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 3,
    fontFamily: typography.fonts.rajdhani,
  },
  infoBoxText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
    fontFamily: typography.fonts.inter,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: typography.fonts.rajdhani,
  },
  trainersList: {
    gap: 8,
    marginBottom: 8,
  },
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  trainerCardActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: '#A855F7',
  },
  trainerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  trainerPhone: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fonts.inter,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
});
