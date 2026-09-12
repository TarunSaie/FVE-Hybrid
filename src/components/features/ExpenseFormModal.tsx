import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEDatePickerModal } from '@/components/common/FVEDatePickerModal';
import { Expense, EXPENSE_CATEGORIES } from '@/types';
import { supabase } from '@/api/supabase';
import { getLocalDateStr, formatDate } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface ExpenseFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  expense?: Expense | null;
}

export function ExpenseFormModal({
  visible,
  onClose,
  onSaved,
  expense,
}: ExpenseFormModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getExpenseFormStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string>('Rent');
  const amountRef = useRef('');
  const descriptionRef = useRef('');
  const [expenseDate, setExpenseDate] = useState(() => getLocalDateStr());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (expense) {
      setCategory(expense.category || 'Rent');
      amountRef.current = expense.amount ? String(expense.amount) : '';
      descriptionRef.current = expense.description || '';
      setExpenseDate(expense.expense_date || getLocalDateStr());
    } else {
      setCategory('Rent');
      amountRef.current = '';
      descriptionRef.current = '';
      setExpenseDate(getLocalDateStr());
    }
  }, [expense, visible]);

  const handleSave = async () => {
    if (!amountRef.current || isNaN(Number(amountRef.current)) || Number(amountRef.current) <= 0) {
      return Alert.alert('Error', 'Please enter a valid expense amount');
    }

    setLoading(true);
    try {
      if (expense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            category,
            amount: String(amountRef.current),
            description: descriptionRef.current.trim() || null,
            expense_date: expenseDate,
          })
          .eq('id', expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({
            category,
            amount: String(amountRef.current),
            description: descriptionRef.current.trim() || null,
            expense_date: expenseDate,
            created_by: user?.id || null,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to record expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={expense ? 'Edit Expense' : 'Add Expense'}
      subtitle="Track gym operating expenses"
    >
      <View style={styles.form}>
        {/* Category selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>EXPENSE CATEGORY *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EXPENSE_CATEGORIES.map(cat => {
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.chip, isSelected && styles.selectedChip]}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <FVEInput
          label="AMOUNT (INR) *"
          defaultValue={amountRef.current}
          onChangeText={(t) => { amountRef.current = t; }}
          placeholder="e.g. 5000"
          keyboardType="numeric"
        />

        {/* Interactive Expense Date */}
        <View style={styles.dateFieldContainer}>
          <Text style={styles.dateFieldLabel}>EXPENSE DATE *</Text>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowDatePicker(true);
            }}
            style={styles.datePickerTrigger}
            activeOpacity={0.8}
          >
            <Calendar size={15} color={colors.gold} />
            <Text style={styles.datePickerValueText}>
              {expenseDate ? formatDate(expenseDate) : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>

        <FVEInput
          label="DESCRIPTION / NOTES"
          defaultValue={descriptionRef.current}
          onChangeText={(t) => { descriptionRef.current = t; }}
          placeholder="Details of the payment or bill"
          multiline
        />

        <FVEButton
          title={expense ? 'UPDATE EXPENSE' : 'RECORD EXPENSE'}
          onPress={handleSave}
          loading={loading}
          variant="gold"
          size="lg"
          style={styles.saveButton}
        />
      </View>

      <FVEDatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(d) => setExpenseDate(d)}
        initialDate={expenseDate}
        title="SELECT EXPENSE DATE"
      />
    </FVEModal>
  );
}

const getExpenseFormStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    form: {
      paddingBottom: 20,
    },
    fieldSection: {
      marginBottom: 16,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    chip: {
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    selectedChip: {
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.15)',
      borderColor: colors.gold,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
    },
    selectedChipText: {
      color: colors.gold,
      fontWeight: '700',
    },
    saveButton: {
      marginTop: 10,
    },
    dateFieldContainer: {
      marginBottom: 16,
    },
    dateFieldLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    datePickerTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.bgSecondary,
      borderWidth: 1.2,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : colors.goldBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    datePickerValueText: {
      color: colors.gold,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });
