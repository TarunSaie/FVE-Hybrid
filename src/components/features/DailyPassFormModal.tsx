import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEDatePickerModal } from '@/components/common/FVEDatePickerModal';
import { DailyPass, DailyPassPaymentStatus, PAYMENT_METHODS } from '@/types';
import { supabase } from '@/api/supabase';
import { getLocalDateStr, formatDate } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface DailyPassFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  pass?: DailyPass | null;
}

const PURPOSE_OPTIONS = ['Day Visit', 'Trial Session', 'Guest Visit', 'Other'] as const;
const PAYMENT_STATUS_OPTIONS: DailyPassPaymentStatus[] = ['PAID', 'PENDING', 'WAIVED'];

export function DailyPassFormModal({
  visible,
  onClose,
  onSaved,
  pass,
}: DailyPassFormModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [mobile, setMobile] = useState('');
  const [purpose, setPurpose] = useState<string>('Day Visit');
  const [passDate, setPassDate] = useState(() => getLocalDateStr());
  const [amount, setAmount] = useState('100');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<DailyPassPaymentStatus>('PAID');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (pass) {
      setVisitorName(pass.visitor_name || '');
      setMobile(pass.mobile || '');
      setPurpose(pass.purpose || 'Day Visit');
      setPassDate(pass.pass_date || getLocalDateStr());
      setAmount(pass.amount || '100');
      setPaymentMethod(pass.payment_method || 'Cash');
      setPaymentStatus(pass.payment_status || 'PAID');
      setNotes(pass.notes || '');
    } else {
      setVisitorName('');
      setMobile('');
      setPurpose('Day Visit');
      setPassDate(getLocalDateStr());
      setAmount('100');
      setPaymentMethod('Cash');
      setPaymentStatus('PAID');
      setNotes('');
    }
  }, [pass, visible]);

  const handleSave = async () => {
    if (!visitorName.trim()) {
      haptics.warning();
      return Alert.alert('Error', 'Please enter visitor name');
    }

    const numAmount = parseFloat(amount.trim());
    if (isNaN(numAmount) || numAmount < 0) {
      haptics.warning();
      return Alert.alert('Error', 'Please enter a valid amount');
    }

    setLoading(true);
    try {
      if (pass) {
        const { error } = await supabase
          .from('daily_passes')
          .update({
            visitor_name: visitorName.trim(),
            mobile: mobile.trim() || null,
            purpose: purpose || 'Day Visit',
            pass_date: passDate,
            amount: numAmount.toString(),
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            notes: notes.trim() || '',
          })
          .eq('id', pass.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_passes')
          .insert({
            visitor_name: visitorName.trim(),
            mobile: mobile.trim() || null,
            purpose: purpose || 'Day Visit',
            pass_date: passDate,
            amount: numAmount.toString(),
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            notes: notes.trim() || '',
            issued_by: user?.id || null,
          });

        if (error) throw error;
      }

      haptics.success();
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to issue daily pass');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <FVEModal
        visible={visible}
        onClose={onClose}
        title={pass ? 'Edit Daily Pass' : 'Issue Daily Pass'}
        subtitle="Single-day facility access token (₹100)"
      >
      <View style={styles.form}>
        <FVEInput
          label="VISITOR NAME *"
          value={visitorName}
          onChangeText={setVisitorName}
          placeholder="Enter full name"
          autoCapitalize="words"
        />

        <FVEInput
          label="MOBILE NUMBER"
          value={mobile}
          onChangeText={setMobile}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
        />

        {/* Purpose selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>PURPOSE OF VISIT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PURPOSE_OPTIONS.map((opt) => {
              const isSelected = purpose === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    haptics.light();
                    setPurpose(opt);
                  }}
                  style={[styles.chip, isSelected && styles.selectedChip]}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Pass Date */}
        <View style={styles.dateFieldContainer}>
          <Text style={styles.dateFieldLabel}>PASS DATE *</Text>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowDatePicker(true);
            }}
            style={styles.datePickerTrigger}
            activeOpacity={0.8}
          >
            <Calendar size={16} color={colors.gold} />
            <Text style={styles.datePickerValueText}>
              {passDate ? formatDate(passDate) : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <FVEInput
          label="PASS FEE (INR) *"
          value={amount}
          onChangeText={setAmount}
          placeholder="100"
          keyboardType="numeric"
        />

        {/* Payment Method selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PAYMENT_METHODS.map((pm) => {
              const isSelected = paymentMethod === pm;
              return (
                <TouchableOpacity
                  key={pm}
                  onPress={() => {
                    haptics.light();
                    setPaymentMethod(pm);
                  }}
                  style={[styles.chip, isSelected && styles.selectedChip]}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {pm}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Payment Status selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>PAYMENT STATUS</Text>
          <View style={styles.statusRow}>
            {PAYMENT_STATUS_OPTIONS.map((st) => {
              const isSelected = paymentStatus === st;
              const isPaid = st === 'PAID';
              const isPending = st === 'PENDING';
              return (
                <TouchableOpacity
                  key={st}
                  onPress={() => {
                    haptics.light();
                    setPaymentStatus(st);
                  }}
                  style={[
                    styles.statusChip,
                    isSelected &&
                      (isPaid
                        ? styles.paidStatusSelected
                        : isPending
                        ? styles.pendingStatusSelected
                        : styles.waivedStatusSelected),
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      isSelected &&
                        (isPaid
                          ? styles.paidStatusText
                          : isPending
                          ? styles.pendingStatusText
                          : styles.waivedStatusText),
                    ]}
                  >
                    {st}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FVEInput
          label="NOTES / REMARKS"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes or reference ID"
          multiline
        />

        <FVEButton
          title={pass ? 'UPDATE DAILY PASS' : 'ISSUE DAILY PASS (₹' + amount + ')'}
          onPress={handleSave}
          loading={loading}
          variant="gold"
          size="lg"
          style={styles.saveButton}
        />
      </View>

      </FVEModal>
      <FVEDatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(d) => setPassDate(d)}
        initialDate={passDate}
        title="SELECT PASS DATE"
      />
    </>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    form: {
      paddingBottom: 24,
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
      paddingHorizontal: 14,
      paddingVertical: 9,
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
    statusRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statusChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 8,
      paddingVertical: 10,
    },
    statusChipText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
      letterSpacing: 0.6,
    },
    paidStatusSelected: {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      borderColor: colors.success,
    },
    paidStatusText: {
      color: colors.success,
      fontWeight: '700',
    },
    pendingStatusSelected: {
      backgroundColor: 'rgba(239, 161, 0, 0.15)',
      borderColor: colors.gold,
    },
    pendingStatusText: {
      color: colors.gold,
      fontWeight: '700',
    },
    waivedStatusSelected: {
      backgroundColor: 'rgba(148, 163, 184, 0.15)',
      borderColor: colors.textMuted,
    },
    waivedStatusText: {
      color: colors.textMuted,
      fontWeight: '700',
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
      gap: 10,
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
    saveButton: {
      marginTop: 10,
    },
  });
