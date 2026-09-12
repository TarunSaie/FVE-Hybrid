import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { Dumbbell, ShieldCheck, UserCheck } from 'lucide-react-native';
import { UserProfile } from '@/types';

interface PTRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  memberId: string;
  memberName: string;
  membershipId?: string | null;
  planName?: string | null;
}

const DEFAULT_PACKAGES = [
  { id: 'p1', name: '12 Sessions — Strength & Form', sessions: 12, price: 6000, days: 45 },
  { id: 'p2', name: '24 Sessions — Transformation Pro', sessions: 24, price: 11000, days: 90 },
  { id: 'p3', name: '36 Sessions — Elite Athlete Track', sessions: 36, price: 15000, days: 120 },
];

export function PTRequestModal({
  visible,
  onClose,
  onSaved,
  memberId,
  memberName,
  membershipId,
  planName,
}: PTRequestModalProps) {
  const { user } = useAuth();
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('p1');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [packageName, setPackageName] = useState(DEFAULT_PACKAGES[0].name);
  const [sessions, setSessions] = useState(String(DEFAULT_PACKAGES[0].sessions));
  const [selectedPrice, setSelectedPrice] = useState<number>(DEFAULT_PACKAGES[0].price);
  const [goals, setGoals] = useState('Strength building, fat loss, and form correction');
  const [preferredTrainerId, setPreferredTrainerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (visible) {
      fetchTrainers();
      fetchPTPlans();
    }
  }, [visible]);

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
      // Ignore
    }
  };

  const fetchPTPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('personal_training_plans')
        .select('*')
        .eq('active', true)
        .order('total_sessions', { ascending: true });
      if (!error && data && data.length > 0) {
        setDbPlans(data);
        setSelectedPkgId(data[0].id);
        setPackageName(data[0].name);
        setSessions(String(data[0].total_sessions));
        setSelectedPrice(Number(data[0].price || 0));
      }
    } catch {
      // Fallback to defaults
    }
  };

  const availablePackages = dbPlans.length > 0
    ? dbPlans.map(p => ({
        id: p.id,
        name: p.name,
        sessions: p.total_sessions,
        price: Number(p.price || 0),
        days: p.duration_days,
      }))
    : DEFAULT_PACKAGES;

  const handleSelectPackage = (pkg: { id: string; name: string; sessions: number; price: number; days: number }) => {
    haptics.selection();
    setIsCustom(false);
    setSelectedPkgId(pkg.id);
    setPackageName(pkg.name);
    setSessions(String(pkg.sessions));
    setSelectedPrice(pkg.price);
  };

  const handleSelectCustom = () => {
    haptics.selection();
    setIsCustom(true);
    setSelectedPkgId('custom');
    setPackageName('Custom PT Package');
    setSessions('10');
    setSelectedPrice(5000);
  };

  const handleSubmit = async () => {
    if (!packageName.trim()) {
      haptics.warning();
      return Alert.alert('Missing Info', 'Please provide a package title.');
    }
    const parsedSessions = parseInt(sessions.trim(), 10);
    if (isNaN(parsedSessions) || parsedSessions <= 0) {
      haptics.warning();
      return Alert.alert('Invalid Sessions', 'Sessions count must be at least 1.');
    }

    setLoading(true);
    try {
      const estPrice = selectedPrice > 0 ? selectedPrice : parsedSessions * 500;

      const { data: ptRecord, error } = await supabase
        .from('personal_training')
        .insert({
          member_id: memberId,
          membership_id: membershipId || null,
          trainer_id: preferredTrainerId || null,
          package_name: packageName.trim(),
          total_sessions: parsedSessions,
          sessions_completed: 0,
          price: String(estPrice),
          status: 'REQUESTED',
          special_goals: goals.trim(),
          notes: notes.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Broadcast Notification to Owners and Admins
      try {
        const { data: admins } = await supabase
          .from('user_profiles')
          .select('id')
          .in('role', ['OWNER', 'ADMIN']);

        if (admins && admins.length > 0) {
          const notifications = admins.map(a => ({
            user_id: a.id,
            title: 'New Personal Training Request',
            message: `${memberName} requested ${packageName.trim()} (${parsedSessions} sessions).`,
            type: 'INFO',
          }));
          await supabase.from('notifications').insert(notifications);
        }
      } catch {
        // Suppress notification error
      }

      haptics.success();
      Alert.alert('Request Sent', 'Personal Training request submitted for Owner review and trainer assignment!');
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to submit Personal Training request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="REQUEST PERSONAL TRAINING"
      subtitle={`Member: ${memberName}`}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Protection Note */}
        <View style={styles.protectionBox}>
          <ShieldCheck size={16} color={colors.gold} />
          <Text style={styles.protectionText}>
            Personal Training is an <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Add-On Service</Text> linked to your active subscription ({planName || 'Gym Access'}). Your base membership remains 100% active.
          </Text>
        </View>

        {/* Package Presets */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.fieldLabel}>CHOOSE PACKAGE TEMPLATE</Text>
          <Text style={{ fontSize: 10, color: colors.gold, fontFamily: typography.fonts.rajdhani }}>OWNER PACKAGES</Text>
        </View>

        <View style={styles.templateGrid}>
          {availablePackages.map((pkg) => {
            const isSelected = !isCustom && selectedPkgId === pkg.id;
            return (
              <TouchableOpacity
                key={pkg.id}
                onPress={() => handleSelectPackage(pkg)}
                style={[
                  styles.templateCard,
                  isSelected && styles.templateCardActive,
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.templateTitle, isSelected && { color: colors.gold }]}>
                  {pkg.name}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={styles.templateSessions}>
                    {pkg.sessions} Sessions · {pkg.days} Days
                  </Text>
                  {pkg.price > 0 && (
                    <Text style={{ color: colors.gold, fontSize: 11, fontFamily: typography.fonts.rajdhani }}>
                      ₹{pkg.price}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Custom Package Option */}
          <TouchableOpacity
            onPress={handleSelectCustom}
            style={[
              styles.templateCard,
              isCustom && styles.templateCardActive,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.templateTitle, isCustom && { color: colors.gold }]}>
              Custom Package
            </Text>
            <Text style={styles.templateSessions}>
              Specify custom session count & pricing
            </Text>
          </TouchableOpacity>
        </View>

        {/* Custom Sessions input if custom selected */}
        {isCustom && (
          <View style={styles.rowInputs}>
            <View style={{ flex: 2 }}>
              <FVEInput
                label="PACKAGE TITLE"
                value={packageName}
                onChangeText={setPackageName}
                placeholder="e.g. 10 Sessions Fast Track"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FVEInput
                label="SESSIONS"
                value={sessions}
                onChangeText={setSessions}
                keyboardType="numeric"
                placeholder="10"
              />
            </View>
          </View>
        )}

        {/* Trainer preference */}
        {trainers.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.fieldLabel}>PREFERRED TRAINER (OPTIONAL)</Text>
            <View style={styles.trainerChipsRow}>
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setPreferredTrainerId('');
                }}
                style={[
                  styles.trainerChip,
                  !preferredTrainerId && styles.trainerChipActive,
                ]}
              >
                <Text style={[styles.trainerChipText, !preferredTrainerId && styles.trainerChipTextActive]}>
                  Any Available
                </Text>
              </TouchableOpacity>
              {trainers.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    haptics.selection();
                    setPreferredTrainerId(t.id);
                  }}
                  style={[
                    styles.trainerChip,
                    preferredTrainerId === t.id && styles.trainerChipActive,
                  ]}
                >
                  <Text style={[styles.trainerChipText, preferredTrainerId === t.id && styles.trainerChipTextActive]}>
                    {t.full_name || t.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Fitness Goals */}
        <FVEInput
          label="PRIMARY FITNESS GOALS"
          value={goals}
          onChangeText={setGoals}
          placeholder="e.g. Strength, fat loss, muscle tone"
          multiline
          numberOfLines={2}
          containerStyle={{ marginTop: 12 }}
        />

        {/* Medical / Schedule Notes */}
        <FVEInput
          label="SCHEDULE / MEDICAL PREFERENCES"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. 7 AM timing, back precaution"
          multiline
          numberOfLines={2}
          containerStyle={{ marginTop: 12 }}
        />

        {/* Action Button */}
        <FVEButton
          title="SUBMIT PT REQUEST"
          onPress={handleSubmit}
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
  protectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 161, 0, 0.08)',
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  protectionText: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
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
  templateGrid: {
    gap: 8,
    marginBottom: 12,
  },
  templateCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  templateCardActive: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderColor: colors.gold,
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  templateSessions: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: typography.fonts.inter,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  trainerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  trainerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  trainerChipActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: '#A855F7',
  },
  trainerChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  trainerChipTextActive: {
    color: '#D8B4FE',
    fontWeight: '700',
  },
});
