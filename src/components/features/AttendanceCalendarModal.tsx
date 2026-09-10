import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, UserCheck } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { Member } from '@/types';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { getLocalDateStr, formatDate } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface AttendanceCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  member: Member | { id: string; full_name: string; member_id?: string | null };
  membershipStartDate?: string;
  membershipExpiryDate?: string;
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function AttendanceCalendarModal({
  visible,
  onClose,
  member,
  membershipStartDate,
  membershipExpiryDate,
}: AttendanceCalendarModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getCalendarStyles(colors, isDark), [colors, isDark]);
  const today = new Date();
  const todayStr = getLocalDateStr(today);

  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth() + 1);

  // Fetch all attendance for this member
  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['member-attendance-calendar', member.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, check_in_time, check_in_method')
        .eq('member_id', member.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: visible && !!member.id,
  });

  const attendanceMap = useMemo(() => {
    const map = new Map<string, { check_in_time?: string; check_in_method?: string }>();
    (attendanceRecords || []).forEach(r => {
      map.set(r.date, { check_in_time: r.check_in_time, check_in_method: r.check_in_method });
    });
    return map;
  }, [attendanceRecords]);

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  const goPrevMonth = () => {
    haptics.selection();
    if (viewMonth === 1) {
      setViewYear(y => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goNextMonth = () => {
    haptics.selection();
    if (viewMonth === 12) {
      setViewYear(y => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Month-specific attendance counts
  const monthKeyPrefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
  const thisMonthVisits = useMemo(() => {
    return (attendanceRecords || []).filter(r => r.date.startsWith(monthKeyPrefix)).length;
  }, [attendanceRecords, monthKeyPrefix]);

  const totalVisits = (attendanceRecords || []).length;

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="ATTENDANCE LOG"
      subtitle={member.full_name}
    >
      <View style={styles.container}>
        {/* KPI Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxGreen]}>
            <Text style={styles.statNumber}>{isLoading ? '…' : thisMonthVisits}</Text>
            <Text style={styles.statLabel}>THIS MONTH</Text>
          </View>

          <View style={[styles.statBox, styles.statBoxGold]}>
            <Text style={[styles.statNumber, { color: colors.gold }]}>
              {isLoading ? '…' : totalVisits}
            </Text>
            <Text style={styles.statLabel}>ALL TIME VISITS</Text>
          </View>
        </View>

        {/* Month Navigation Header */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={goPrevMonth}
            style={styles.navArrowBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={20} color={colors.gold} />
          </TouchableOpacity>

          <View style={styles.monthTitleWrap}>
            <CalendarIcon size={16} color={colors.gold} />
            <Text style={styles.monthTitleText}>{getMonthLabel(viewYear, viewMonth)}</Text>
          </View>

          <TouchableOpacity
            onPress={goNextMonth}
            style={styles.navArrowBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronRight size={20} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* Day Headers (Su, Mo, Tu, ...) */}
        <View style={styles.dayHeadersRow}>
          {DAY_HEADERS.map((day, idx) => (
            <View key={idx} style={styles.dayHeaderCell}>
              <Text
                style={[
                  styles.dayHeaderText,
                  (idx === 0 || idx === 6) && styles.weekendHeader,
                ]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.loadingText}>Loading attendance calendar...</Text>
          </View>
        ) : (
          <View style={styles.calendarGrid}>
            {/* Leading blank days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.calendarCell} />
            ))}

            {/* Days 1 to daysInMonth */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isAttended = attendanceMap.has(dateStr);
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const details = attendanceMap.get(dateStr);

              return (
                <View
                  key={`day-${dayNum}`}
                  style={[
                    styles.calendarCell,
                    isAttended && styles.cellAttended,
                    isToday && styles.cellToday,
                    isFuture && styles.cellFuture,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellDayText,
                      isAttended && styles.cellDayTextAttended,
                      isToday && styles.cellDayTextToday,
                      isFuture && styles.cellDayTextFuture,
                    ]}
                  >
                    {dayNum}
                  </Text>
                  {isAttended && (
                    <View style={styles.checkDot}>
                      <UserCheck size={9} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Attended</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { borderColor: colors.gold, borderWidth: 1 }]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1A1E24' }]} />
            <Text style={styles.legendText}>Absent / Rest</Text>
          </View>
        </View>
      </View>
    </FVEModal>
  );
}

const getCalendarStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    statBox: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statBoxGreen: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.35)',
    },
    statBoxGold: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.1)' : 'rgba(239, 161, 0, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : 'rgba(239, 161, 0, 0.35)',
    },
    statNumber: {
      fontSize: 22,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.success,
    },
    statLabel: {
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginTop: 2,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      marginBottom: 14,
    },
    navArrowBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.1)' : 'rgba(239, 161, 0, 0.12)',
    },
    monthTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    monthTitleText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: typography.sizes.base,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dayHeadersRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    dayHeaderCell: {
      width: `${100 / 7}%`,
      alignItems: 'center',
    },
    dayHeaderText: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    weekendHeader: {
      color: colors.goldMuted,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors.bgSecondary,
      borderRadius: 14,
      padding: 6,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    calendarCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      marginVertical: 2,
      position: 'relative',
    },
    cellAttended: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.18)',
      borderWidth: 1,
      borderColor: colors.success,
    },
    cellToday: {
      borderWidth: 1.5,
      borderColor: colors.gold,
    },
    cellFuture: {
      opacity: 0.35,
    },
    cellDayText: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    cellDayTextAttended: {
      color: isDark ? '#4ADE80' : '#15803D',
      fontWeight: '700',
    },
    cellDayTextToday: {
      color: colors.gold,
      fontWeight: '800',
    },
    cellDayTextFuture: {
      color: colors.textMuted,
    },
    checkDot: {
      position: 'absolute',
      bottom: 3,
      backgroundColor: colors.success,
      borderRadius: 6,
      padding: 1,
    },
    loadingBox: {
      paddingVertical: 36,
      alignItems: 'center',
      gap: 8,
    },
    loadingText: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textSecondary,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderDefault,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
