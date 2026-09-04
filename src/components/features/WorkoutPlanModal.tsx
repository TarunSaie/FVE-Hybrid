import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface WorkoutPlanModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  memberId: string;
  memberName: string;
}

const TEMPLATES = [
  { title: 'Push / Pull / Legs (PPL)', description: 'Day 1: Chest/Shoulders/Triceps\nDay 2: Back/Biceps/Rear Delts\nDay 3: Legs/Abs/Calves\nRest & Repeat' },
  { title: 'Fat Loss & HIIT Conditioning', description: '20 min HIIT Cardio + 4x12 supersets: Goblet squats, Kettlebell swings, Pushups, Plank hold 60s' },
  { title: 'Strength & Hypertrophy', description: 'Compound focus: Barbell Bench 4x6, Barbell Squats 4x6, Romanian Deadlifts 3x8, Overhead Press 3x8' },
  { title: 'Beginner Full Body Foundation', description: 'Full body routine 3 days/week: Lat pulldown, Leg press, Dumbbell press, Plank, Cable row' },
];

export function WorkoutPlanModal({
  visible,
  onClose,
  onSaved,
  memberId,
  memberName,
}: WorkoutPlanModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState('');

  const handleSelectTemplate = (tpl: { title: string; description: string }) => {
    haptics.selection();
    setTitle(tpl.title);
    setDescription(tpl.description);
    setTitleError('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      haptics.warning();
      setTitleError('Plan title is required');
      return;
    }
    setTitleError('');
    setLoading(true);

    try {
      const { error } = await supabase.from('workout_plans').insert({
        member_id: memberId,
        trainer_id: user?.id || null,
        title: title.trim(),
        description: description.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      haptics.success();
      Alert.alert('Success', `Workout plan assigned to ${memberName}!`);
      setTitle('');
      setDescription('');
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to assign workout plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="ASSIGN WORKOUT PLAN"
      subtitle={memberName}
    >
      <View style={styles.container}>
        {/* Quick Templates */}
        <Text style={styles.sectionLabel}>PRESET TEMPLATES</Text>
        <View style={styles.templatesWrap}>
          {TEMPLATES.map((tpl, i) => (
            <FVEButton
              key={i}
              title={tpl.title}
              size="sm"
              variant="outline"
              onPress={() => handleSelectTemplate(tpl)}
              style={styles.templateBtn}
            />
          ))}
        </View>

        {/* Plan Title */}
        <FVEInput
          label="PLAN TITLE *"
          placeholder="e.g. 4-Day Hypertrophy Split"
          value={title}
          onChangeText={t => {
            setTitle(t);
            if (titleError) setTitleError('');
          }}
          error={titleError}
        />

        {/* Plan Details / Exercise Routine */}
        <FVEInput
          label="ROUTINE & EXERCISE BREAKDOWN"
          placeholder="List exercises, sets, reps, or notes for this workout plan..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          style={styles.textArea}
        />

        {/* Action Button */}
        <View style={styles.actions}>
          <FVEButton
            title="ASSIGN PLAN TO MEMBER"
            onPress={handleSave}
            loading={loading}
            variant="gold"
          />
        </View>
      </View>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
    gap: 16,
  },
  sectionLabel: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  templatesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateBtn: {
    alignSelf: 'flex-start',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: 8,
  },
});
