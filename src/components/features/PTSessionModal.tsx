import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { getLocalDateStr } from '@/utils/date';
import { PersonalTraining, PTSession } from '@/types';
import { Calendar, CheckCircle2, Dumbbell, Clock } from 'lucide-react-native';

interface PTSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  pt: PersonalTraining;
  session?: PTSession | null;
  mode?: 'schedule' | 'complete';
}

const COMMON_TIMES = [
  '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM',
  '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM'
];

const FOCUS_AREAS = [
  'Chest & Triceps',
  'Back & Biceps',
  'Legs & Core',
  'Shoulders & Traps',
  'Full Body Conditioning',
  'HIIT & Cardio',
  'Mobility & Posture'
];

export function PTSessionModal({
  visible,
  onClose,
  onSaved,
  pt,
  session,
  mode = 'schedule',
}: PTSessionModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getPTSessionStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();
  const isCompleting = mode === 'complete' && !!session;

  const [sessionDate, setSessionDate] = useState<string>(getLocalDateStr());
  const [startTime, setStartTime] = useState<string>('07:00 AM');
  const [focusArea, setFocusArea] = useState<string>(FOCUS_AREAS[0]);
  const [workoutNotes, setWorkoutNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      if (isCompleting && session) {
        setWorkoutNotes(session.workout_notes || '');
        setFeedback(session.feedback || '');
      } else {
        setSessionDate(getLocalDateStr());
        setStartTime('07:00 AM');
        setFocusArea(FOCUS_AREAS[0]);
        setWorkoutNotes('');
        setFeedback('');
      }
    }
  }, [visible, isCompleting, session]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isCompleting && session) {
        // 1. Mark session COMPLETED
        const { error: sErr } = await supabase
          .from('pt_sessions')
          .update({
            status: 'COMPLETED',
            workout_notes: workoutNotes.trim() || focusArea,
            feedback: feedback.trim(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        if (sErr) throw sErr;

        // 2. Increment completed count on Personal Training plan
        const newCompletedCount = (pt.sessions_completed || 0) + 1;
        const newStatus = newCompletedCount >= pt.total_sessions ? 'COMPLETED' : 'ACTIVE';

        const { error: ptErr } = await supabase
          .from('personal_training')
          .update({
            sessions_completed: newCompletedCount,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pt.id);

        if (ptErr) throw ptErr;

        // 3. Notify member & trainer
        try {
          await supabase.from('notifications').insert({
            user_id: pt.member_id,
            title: 'PT Session Completed!',
            message: `Session ${newCompletedCount} of ${pt.total_sessions} completed! Keep up the great work!`,
            type: 'SUCCESS',
          });
        } catch {
          // Suppress
        }

        haptics.success();
        Alert.alert(
          'Session Completed',
          newStatus === 'COMPLETED'
            ? `All ${pt.total_sessions} sessions completed! Package concluded.`
            : `Session logged! (${newCompletedCount} of ${pt.total_sessions} sessions completed)`
        );
      } else {
        // Schedule new session
        const trainerId = pt.trainer_id || user?.id;
        if (!trainerId) {
          haptics.warning();
          Alert.alert('Missing Trainer', 'No trainer assigned to this Personal Training plan');
          setLoading(false);
          return;
        }

        const fullNotes = focusArea + (workoutNotes.trim() ? ` — ${workoutNotes.trim()}` : '');

        const { error: insertErr } = await supabase
          .from('pt_sessions')
          .insert({
            personal_training_id: pt.id,
            member_id: pt.member_id,
            trainer_id: trainerId,
            session_date: sessionDate,
            start_time: startTime,
            status: 'SCHEDULED',
            workout_notes: fullNotes,
            created_by: user?.id,
          });

        if (insertErr) throw insertErr;

        // Notify member
        try {
          await supabase.from('notifications').insert({
            user_id: pt.member_id,
            title: 'PT Session Scheduled',
            message: `Your training session is scheduled for ${sessionDate} at ${startTime}.`,
            type: 'INFO',
          });
        } catch {
          // Suppress
        }

        haptics.success();
        Alert.alert('Session Scheduled', `Session confirmed for ${sessionDate} at ${startTime}!`);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to process session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={isCompleting ? 'COMPLETE SESSION' : 'SCHEDULE PT SESSION'}
      subtitle={`Client: ${pt.members?.full_name || 'Member'} · Session ${(pt.sessions_completed || 0) + 1} of ${pt.total_sessions}`}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {!isCompleting ? (
          <>
            {/* Session Date */}
            <FVEInput
              label="SESSION DATE (YYYY-MM-DD) *"
              value={sessionDate}
              onChangeText={setSessionDate}
              placeholder="YYYY-MM-DD"
            />

            {/* Time Selector */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>START TIME</Text>
            <View style={styles.timeGrid}>
              {COMMON_TIMES.map(time => (
                <TouchableOpacity
                  key={time}
                  onPress={() => {
                    haptics.selection();
                    setStartTime(time);
                  }}
                  style={[
                    styles.timeBtn,
                    startTime === time && styles.timeBtnActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timeBtnText, startTime === time && styles.timeBtnTextActive]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Focus Areas */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>WORKOUT FOCUS AREA</Text>
            <View style={styles.focusGrid}>
              {FOCUS_AREAS.map(area => (
                <TouchableOpacity
                  key={area}
                  onPress={() => {
                    haptics.selection();
                    setFocusArea(area);
                  }}
                  style={[
                    styles.focusBtn,
                    focusArea === area && styles.focusBtnActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.focusBtnText, focusArea === area && styles.focusBtnTextActive]}>
                    {area}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Additional Session Notes */}
            <FVEInput
              label="NOTES / INSTRUCTIONS (OPTIONAL)"
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder="e.g. Focus on squat depth, resistance bands required"
              multiline
              numberOfLines={2}
              containerStyle={{ marginTop: 14 }}
            />
          </>
        ) : (
          <>
            {/* Completed Session Details Banner */}
            <View style={styles.completeHeader}>
              <CheckCircle2 size={16} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.completeTitle}>LOGGING WORKOUT PROGRESS</Text>
                <Text style={styles.completeSubtitle}>
                  {session?.session_date} at {session?.start_time} · {session?.workout_notes || 'Personal Training'}
                </Text>
              </View>
            </View>

            {/* Exercises Logged */}
            <FVEInput
              label="EXERCISES & WEIGHTS PERFORMED"
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder="e.g. Back Squat 4x8 @ 80kg, Leg Press 3x12 @ 140kg, Lunges 3x15"
              multiline
              numberOfLines={3}
              containerStyle={{ marginTop: 12 }}
            />

            {/* Trainer Feedback */}
            <FVEInput
              label="TRAINER FEEDBACK & HOMEWORK"
              value={feedback}
              onChangeText={setFeedback}
              placeholder="e.g. Strong form on presses, recommended 10 min foam rolling"
              multiline
              numberOfLines={2}
              containerStyle={{ marginTop: 12 }}
            />
          </>
        )}

        {/* Submit Action */}
        <FVEButton
          title={isCompleting ? 'MARK AS COMPLETED' : 'CONFIRM SCHEDULE'}
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

const getPTSessionStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
      fontFamily: typography.fonts.rajdhani,
    },
    timeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    timeBtn: {
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      alignItems: 'center',
      minWidth: '18%',
    },
    timeBtnActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(239, 161, 0, 0.2)',
      borderColor: colors.gold,
    },
    timeBtnText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      fontFamily: typography.fonts.inter,
    },
    timeBtnTextActive: {
      color: colors.gold,
      fontWeight: '700',
    },
    focusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    focusBtn: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    focusBtnActive: {
      backgroundColor: isDark ? 'rgba(0, 102, 255, 0.15)' : 'rgba(0, 102, 255, 0.18)',
      borderColor: colors.blue,
    },
    focusBtnText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
      fontFamily: typography.fonts.inter,
    },
    focusBtnTextActive: {
      color: colors.blueLight,
      fontWeight: '700',
    },
    completeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.12)',
      borderColor: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.35)',
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    completeTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
      letterSpacing: 0.5,
      fontFamily: typography.fonts.rajdhani,
    },
    completeSubtitle: {
      fontSize: 11,
      color: colors.textPrimary,
      marginTop: 2,
      fontFamily: typography.fonts.inter,
    },
  });
