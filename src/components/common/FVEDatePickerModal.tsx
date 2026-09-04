import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar, Check } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface FVEDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  initialDate?: string; // YYYY-MM-DD
  title?: string;
  maxDate?: string;
  minDate?: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function FVEDatePickerModal({
  visible,
  onClose,
  onSelectDate,
  initialDate,
  title = 'SELECT DATE',
  maxDate,
  minDate,
}: FVEDatePickerModalProps) {
  // Parse initial year, month, day
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [viewMode, setViewMode] = useState<'calendar' | 'years'>('calendar');

  useEffect(() => {
    if (visible) {
      if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
        const [y, m, d] = initialDate.split('-').map(Number);
        setSelectedYear(y);
        setSelectedMonth(m - 1);
        setSelectedDay(d);
      } else {
        const now = new Date();
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth());
        setSelectedDay(now.getDate());
      }
      setViewMode('calendar');
    }
  }, [visible, initialDate]);

  // Days in current selected month/year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // First day of current selected month (0 = Sun, 1 = Mon...)
  const firstDayOfWeek = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).getDay();
  }, [selectedYear, selectedMonth]);

  // Year list from 1950 to 2030 (descending)
  const yearsList = useMemo(() => {
    const list: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 4; y >= 1950; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const handlePrevMonth = () => {
    haptics.light();
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    haptics.light();
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    haptics.selection();
    setSelectedDay(day);
  };

  const handleSelectYear = (year: number) => {
    haptics.selection();
    setSelectedYear(year);
    setViewMode('calendar');
  };

  const handleConfirm = () => {
    haptics.medium();
    const safeDay = Math.min(selectedDay, daysInMonth);
    const mStr = String(selectedMonth + 1).padStart(2, '0');
    const dStr = String(safeDay).padStart(2, '0');
    const result = `${selectedYear}-${mStr}-${dStr}`;
    onSelectDate(result);
    onClose();
  };

  const handleToday = () => {
    haptics.light();
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setSelectedDay(now.getDate());
    setViewMode('calendar');
  };

  const formattedSelectedPreview = useMemo(() => {
    const safeDay = Math.min(selectedDay, daysInMonth);
    const dateObj = new Date(selectedYear, selectedMonth, safeDay);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedYear, selectedMonth, selectedDay, daysInMonth]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />

        <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
          <View style={styles.sheet}>
            {/* Sheet Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.sheetTitle}>{title}</Text>
                <Text style={styles.previewDateText}>{formattedSelectedPreview}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Bar */}
            <View style={styles.navBar}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.navArrow}
                disabled={viewMode === 'years'}
              >
                <ChevronLeft
                  size={20}
                  color={viewMode === 'years' ? colors.textMuted : colors.gold}
                />
              </TouchableOpacity>

              <View style={styles.navMiddle}>
                <Text style={styles.monthName}>{MONTHS[selectedMonth]}</Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setViewMode((v) => (v === 'years' ? 'calendar' : 'years'));
                  }}
                  style={styles.yearToggleBtn}
                >
                  <Text style={styles.yearToggleText}>{selectedYear}</Text>
                  <Text style={styles.yearToggleHint}>
                    {viewMode === 'years' ? '◀ Back' : '▼ Change'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navArrow}
                disabled={viewMode === 'years'}
              >
                <ChevronRight
                  size={20}
                  color={viewMode === 'years' ? colors.textMuted : colors.gold}
                />
              </TouchableOpacity>
            </View>

            {/* View Mode: Calendar vs Years Grid */}
            {viewMode === 'years' ? (
              <ScrollView style={styles.yearsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.yearsGrid}>
                  {yearsList.map((y) => {
                    const isSelected = y === selectedYear;
                    return (
                      <TouchableOpacity
                        key={y}
                        onPress={() => handleSelectYear(y)}
                        style={[styles.yearChip, isSelected && styles.selectedYearChip]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.yearChipText, isSelected && styles.selectedYearChipText]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.calendarContainer}>
                {/* Weekday Row */}
                <View style={styles.weekdaysRow}>
                  {WEEKDAYS.map((w, idx) => (
                    <Text
                      key={w}
                      style={[styles.weekdayText, (idx === 0 || idx === 6) && styles.weekendText]}
                    >
                      {w}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {/* Empty leading cells */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.dayCellEmpty} />
                  ))}

                  {/* Days 1..N */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = day === selectedDay;
                    const isCurrentDay =
                      day === today.getDate() &&
                      selectedMonth === today.getMonth() &&
                      selectedYear === today.getFullYear();

                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        onPress={() => handleSelectDay(day)}
                        style={[
                          styles.dayCell,
                          isSelected && styles.selectedDayCell,
                          isCurrentDay && !isSelected && styles.currentDayCell,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.selectedDayText,
                            isCurrentDay && !isSelected && styles.currentDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Bottom Actions */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={handleToday} style={styles.todayBtn} activeOpacity={0.7}>
                <Calendar size={14} color={colors.gold} />
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                style={styles.confirmBtn}
                activeOpacity={0.85}
              >
                <Check size={16} color="#050505" strokeWidth={3} />
                <Text style={styles.confirmBtnText}>SET DATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1318',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previewDateText: {
    color: colors.gold,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  yearToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  yearToggleText: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  yearToggleHint: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: typography.fonts.inter,
  },
  calendarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: 40,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  weekendText: {
    color: colors.gold,
    opacity: 0.7,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  selectedDayCell: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  currentDayCell: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#050505',
    fontWeight: '800',
  },
  currentDayText: {
    color: colors.gold,
    fontWeight: '700',
  },
  yearsScroll: {
    maxHeight: 260,
    paddingHorizontal: 16,
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  yearChip: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#151920',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedYearChip: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  yearChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  selectedYearChipText: {
    color: '#050505',
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  todayBtnText: {
    color: colors.gold,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#050505',
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
