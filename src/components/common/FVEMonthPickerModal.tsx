import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface FVEMonthPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMonth: (monthStr: string) => void; // YYYY-MM
  initialMonth?: string; // YYYY-MM
  title?: string;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function FVEMonthPickerModal({
  visible,
  onClose,
  onSelectMonth,
  initialMonth,
  title = 'SELECT MONTH',
}: FVEMonthPickerModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    if (visible) {
      if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) {
        const [y, m] = initialMonth.split('-').map(Number);
        setSelectedYear(y);
        setSelectedMonth(m - 1);
      } else {
        setSelectedYear(currentYear);
        setSelectedMonth(currentMonth);
      }
    }
  }, [visible, initialMonth, currentYear, currentMonth]);

  const handlePrevYear = () => {
    haptics.light();
    setSelectedYear((y) => y - 1);
  };

  const handleNextYear = () => {
    haptics.light();
    setSelectedYear((y) => y + 1);
  };

  const handleConfirm = (monthIdx: number) => {
    haptics.selection();
    const mm = String(monthIdx + 1).padStart(2, '0');
    const result = `${selectedYear}-${mm}`;
    onSelectMonth(result);
    onClose();
  };

  const handleCurrentMonth = () => {
    haptics.medium();
    const mm = String(currentMonth + 1).padStart(2, '0');
    onSelectMonth(`${currentYear}-${mm}`);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Calendar size={18} color={colors.gold} />
              </View>
              <View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                  {MONTHS_FULL[selectedMonth]} {selectedYear}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Year Selector */}
          <View style={styles.yearRow}>
            <TouchableOpacity onPress={handlePrevYear} style={styles.navBtn} activeOpacity={0.7}>
              <ChevronLeft size={20} color={colors.gold} />
            </TouchableOpacity>
            <Text style={styles.yearText}>{selectedYear}</Text>
            <TouchableOpacity onPress={handleNextYear} style={styles.navBtn} activeOpacity={0.7}>
              <ChevronRight size={20} color={colors.gold} />
            </TouchableOpacity>
          </View>

          {/* Months Grid (3x4) */}
          <View style={styles.grid}>
            {MONTHS_SHORT.map((mName, idx) => {
              const isSelected =
                idx === selectedMonth &&
                initialMonth === `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
              const isCurrent = idx === currentMonth && selectedYear === currentYear;

              return (
                <TouchableOpacity
                  key={mName}
                  onPress={() => handleConfirm(idx)}
                  style={[
                    styles.monthCell,
                    isCurrent && styles.currentMonthCell,
                    isSelected && styles.selectedMonthCell,
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.monthText,
                      isCurrent && styles.currentMonthText,
                      isSelected && styles.selectedMonthText,
                    ]}
                  >
                    {mName}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkIcon}>
                      <Check size={12} color="#000000" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Quick Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleCurrentMonth}
              style={styles.currentMonthBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.currentMonthBtnText}>THIS MONTH</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.bgSecondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : colors.goldBorder,
      padding: 20,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : colors.goldBorder,
    },
    title: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0.8,
    },
    subtitle: {
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.3,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    yearText: {
      fontSize: typography.sizes.lg,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    monthCell: {
      width: '30%',
      aspectRatio: 1.8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderDefault,
      position: 'relative',
    },
    currentMonthCell: {
      borderColor: colors.gold,
    },
    selectedMonthCell: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    monthText: {
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    currentMonthText: {
      color: colors.gold,
    },
    selectedMonthText: {
      color: '#000000',
      fontWeight: '800',
    },
    checkIcon: {
      position: 'absolute',
      right: 4,
      top: 4,
    },
    footer: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      alignItems: 'center',
    },
    currentMonthBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.1)',
      borderWidth: 1,
      borderColor: colors.gold,
    },
    currentMonthBtnText: {
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.8,
    },
  });
