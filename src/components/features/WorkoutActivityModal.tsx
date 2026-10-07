import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEButton } from '@/components/common/FVEButton';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { formatDate, formatTime } from '@/utils/date';
import { Member, Attendance } from '@/types';
import { Dumbbell, Calendar, Clock, CheckCircle2, Trash2, Flame } from 'lucide-react-native';

interface WorkoutActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  member: Member | { id: string; full_name: string; member_id?: string | null };
  attendanceDate: string;
  attendanceRecord?: Attendance | null;
  isPTMember?: boolean;
  trainerName?: string | null;
}

const COMMON_FOCUS_AREAS = [
  'Chest & Triceps',
  'Back & Biceps',
  'Legs & Core',
  'Shoulders & Arms',
  'Full Body',
  'Cardio & HIIT',
  'Mobility & Recovery',
  'Others', 'N/A'
];

export function WorkoutActivityModal({
  visible,
  onClose,
  onSaved,
  member,
  attendanceDate,
  attendanceRecord,
  isPTMember = false,
  trainerName,
}: WorkoutActivityModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getWorkoutModalStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();

  const [workoutActivity, setWorkoutActivity] = useState<string>('');
  const [selectedFocus, setSelectedFocus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      if (attendanceRecord?.workout_activity) {
        setWorkoutActivity(attendanceRecord.workout_activity);
        const matched = COMMON_FOCUS_AREAS.find((f) =>
          attendanceRecord.workout_activity?.toLowerCase().includes(f.toLowerCase())
        );
        setSelectedFocus(matched || '');
      } else {
        setWorkoutActivity('');
        setSelectedFocus('');
      }
    }
  }, [visible, attendanceRecord]);

  const handleSelectFocus = (focus: string) => {
    haptics.selection();
    if (selectedFocus === focus) {
      setSelectedFocus('');
    } else {
      setSelectedFocus(focus);
      if (!workoutActivity.trim()) {
        setWorkoutActivity(`${focus}:\n• `);
      } else if (!workoutActivity.includes(focus)) {
        setWorkoutActivity(`${focus}\n${workoutActivity}`.trim());
      }
    }
  };

  const handleSave = async () => {
    if (!workoutActivity.trim()) {
      Alert.alert('Required', 'Please enter the workout or activity details.');
      return;
    }

    setLoading(true);
    haptics.medium();
    const recordedBy = user?.full_name || user?.email || 'Trainer';
    const nowIso = new Date().toISOString();

    try {
      if (attendanceRecord?.id) {
        const { error } = await supabase
          .from('attendance')
          .update({
            workout_activity: workoutActivity.trim(),
            workout_recorded_at: nowIso,
            workout_recorded_by: recordedBy,
          })
          .eq('id', attendanceRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance')
          .upsert(
            {
              member_id: member.id,
              date: attendanceDate,
              check_in_method: 'MANUAL',
              workout_activity: workoutActivity.trim(),
              workout_recorded_at: nowIso,
              workout_recorded_by: recordedBy,
            },
            { onConflict: 'member_id, date' }
          );

        if (error) throw error;
      }

      haptics.success();
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to save workout activity:', err);
      Alert.alert('Error', (err as Error)?.message || 'Failed to save workout activity');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (!attendanceRecord?.id || !attendanceRecord.workout_activity) {
      setWorkoutActivity('');
      setSelectedFocus('');
      return;
    }

    Alert.alert(
      'Clear Workout Record',
      'Are you sure you want to remove the workout activity recorded for this attendance date?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('attendance')
                .update({
                  workout_activity: null,
                  workout_recorded_at: null,
                  workout_recorded_by: null,
                })
                .eq('id', attendanceRecord.id);

              if (error) throw error;
              haptics.success();
              setWorkoutActivity('');
              setSelectedFocus('');
              onSaved();
              onClose();
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error)?.message || 'Failed to clear workout');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="WORKOUT ACTIVITY"
      subtitle={`${member.full_name} · ${formatDate(attendanceDate)}`}
    >
      <View style={styles.container}>
        {/* PT Badge / Member Info */}
        <View style={styles.metaRow}>
          {isPTMember && (
            <View style={styles.ptBadge}>
              <Flame size={12} color={colors.gold} />
              <Text style={styles.ptBadgeText}>Personal Training</Text>
            </View>
          )}
          {trainerName && (
            <Text style={styles.trainerText}>Trainer: {trainerName}</Text>
          )}
        </View>

        {/* Check-in Info */}
        <View style={styles.checkInCard}>
          <View style={styles.checkInItem}>
            <Calendar size={13} color={colors.gold} />
            <Text style={styles.checkInText}>{formatDate(attendanceDate)}</Text>
          </View>
          {attendanceRecord?.check_in_time && (
            <View style={styles.checkInItem}>
              <Clock size={13} color={colors.textMuted} />
              <Text style={styles.checkInText}>{formatTime(attendanceRecord.check_in_time)}</Text>
            </View>
          )}
          <View style={styles.methodBadge}>
            <Text style={styles.methodText}>{attendanceRecord?.check_in_method || 'MANUAL'}</Text>
          </View>
        </View>

        {/* Focus Areas Chips */}
        <Text style={styles.sectionTitle}>FOCUS AREA</Text>
        <View style={styles.chipsRow}>
          {COMMON_FOCUS_AREAS.map((focus) => {
            const isSelected = selectedFocus === focus;
            return (
              <TouchableOpacity
                key={focus}
                onPress={() => handleSelectFocus(focus)}
                style={[styles.chip, isSelected && styles.chipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {focus}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Workout Details Text Input */}
        <Text style={styles.sectionTitle}>WORKOUT / EXERCISE LOG</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={workoutActivity}
          onChangeText={setWorkoutActivity}
          placeholder="e.g. Incline Bench 4x10 @ 60kg&#10;Cable Crossovers 3x15&#10;Core Plank: 3 mins total"
          placeholderTextColor={colors.textMuted}
        />

        {/* Timestamp of previous recording */}
        {attendanceRecord?.workout_recorded_at && (
          <View style={styles.historyCard}>
            <CheckCircle2 size={13} color={colors.success} />
            <Text style={styles.historyText}>
              Recorded by {attendanceRecord.workout_recorded_by || 'Trainer'} on{' '}
              {formatDate(attendanceRecord.workout_recorded_at)}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          {attendanceRecord?.workout_activity ? (
            <TouchableOpacity
              onPress={handleClear}
              disabled={loading}
              style={styles.clearBtn}
              activeOpacity={0.7}
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <FVEButton
            title={loading ? 'Saving...' : 'Save Activity'}
            onPress={handleSave}
            loading={loading}
            variant="gold"
            icon={<Dumbbell size={16} color={colors.bgPrimary} />}
            style={styles.saveBtn}
          />
        </View>
      </View>
    </FVEModal>
  );
}

const getWorkoutModalStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 24,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    ptBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    ptBadgeText: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    trainerText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
    },
    checkInCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 12,
      padding: 10,
      marginBottom: 16,
    },
    checkInItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    checkInText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: typography.fonts.inter,
      fontWeight: '600',
    },
    methodBadge: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    methodText: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      fontWeight: '700',
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 16,
    },
    chip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      fontWeight: '500',
    },
    chipTextActive: {
      color: '#050505',
      fontWeight: '700',
    },
    textArea: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 12,
      padding: 12,
      color: colors.textPrimary,
      fontSize: 13,
      fontFamily: typography.fonts.inter,
      minHeight: 120,
      marginBottom: 12,
      lineHeight: 18,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.3)',
      borderRadius: 8,
      padding: 8,
      marginBottom: 16,
    },
    historyText: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      flex: 1,
    },
    btnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    clearBtnText: {
      color: '#EF4444',
      fontSize: 12,
      fontFamily: typography.fonts.inter,
      fontWeight: '600',
    },
    saveBtn: {
      flex: 2,
    },
  });
