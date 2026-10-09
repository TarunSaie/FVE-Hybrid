import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Ticket,
  Users,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  X,
  DollarSign,
  Clock,
  Phone,
  AlertCircle,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { FVEDatePickerModal } from '@/components/common/FVEDatePickerModal';
import { FVEMonthPickerModal } from '@/components/common/FVEMonthPickerModal';
import { DailyPassFormModal } from '@/components/features/DailyPassFormModal';
import { DailyPass } from '@/types';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate, getLocalDateStr, getLocalMonthStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';

export function DailyPassScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const today = useMemo(() => getLocalDateStr(), []);
  const currentMonth = useMemo(() => getLocalMonthStr(), []);

  const [filterMode, setFilterMode] = useState<'day' | 'month'>('day');
  const [dateFilter, setDateFilter] = useState(today);
  const [monthFilter, setMonthFilter] = useState(currentMonth);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPass, setSelectedPass] = useState<DailyPass | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Query passes for the selected filter mode
  const {
    data: passes = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['mobile-daily-passes', filterMode, filterMode === 'day' ? dateFilter : monthFilter],
    queryFn: async () => {
      let q = supabase
        .from('daily_passes')
        .select('*')
        .order('pass_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterMode === 'day') {
        q = q.eq('pass_date', dateFilter);
      } else {
        const [year, month] = monthFilter.split('-');
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        q = q
          .gte('pass_date', `${monthFilter}-01`)
          .lte('pass_date', `${monthFilter}-${String(lastDay).padStart(2, '0')}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DailyPass[];
    },
  });

  // Query stats for today (live operational stats)
  const { data: todayStats } = useQuery({
    queryKey: ['mobile-daily-passes-today-stats', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_passes')
        .select('amount, payment_status')
        .eq('pass_date', today);

      if (error) throw error;

      const total = data?.length ?? 0;
      const revenue = (data ?? [])
        .filter((p) => p.payment_status === 'PAID')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const pending = (data ?? []).filter((p) => p.payment_status === 'PENDING').length;

      return { total, revenue, pending };
    },
  });

  // Monthly stats calculated from the returned passes array when in month mode
  const monthStats = useMemo(() => {
    if (filterMode !== 'month') return null;
    const total = passes.length;
    const revenue = passes
      .filter((p) => p.payment_status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pending = passes.filter((p) => p.payment_status === 'PENDING').length;
    return { total, revenue, pending };
  }, [filterMode, passes]);

  const filteredPasses = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return passes;
    return passes.filter(
      (p) =>
        p.visitor_name.toLowerCase().includes(term) ||
        (p.mobile && p.mobile.includes(term)) ||
        (p.purpose && p.purpose.toLowerCase().includes(term))
    );
  }, [passes, debouncedSearch]);

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-daily-passes'] });
    qc.invalidateQueries({ queryKey: ['mobile-daily-passes-today-stats'] });
  }, [qc]);

  // Date Navigation handlers
  const handlePrevDay = () => {
    haptics.light();
    const d = new Date(dateFilter);
    d.setDate(d.getDate() - 1);
    setDateFilter(getLocalDateStr(d));
  };

  const handleNextDay = () => {
    haptics.light();
    const d = new Date(dateFilter);
    d.setDate(d.getDate() + 1);
    setDateFilter(getLocalDateStr(d));
  };

  const handleToday = () => {
    haptics.medium();
    setDateFilter(today);
  };

  // Month Navigation handlers
  const handlePrevMonth = () => {
    haptics.light();
    const [y, m] = monthFilter.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonthFilter(getLocalMonthStr(d));
  };

  const handleNextMonth = () => {
    haptics.light();
    const [y, m] = monthFilter.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonthFilter(getLocalMonthStr(d));
  };

  const handleThisMonth = () => {
    haptics.medium();
    setMonthFilter(currentMonth);
  };

  const formattedMonthLabel = useMemo(() => {
    if (!monthFilter) return '';
    const [y, m] = monthFilter.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }, [monthFilter]);

  const isToday = dateFilter === today;
  const isCurrentMonth = monthFilter === currentMonth;

  const activeStats =
    filterMode === 'month' && monthStats
      ? monthStats
      : todayStats ?? { total: 0, revenue: 0, pending: 0 };

  const statsPeriodLabel =
    filterMode === 'month' ? formattedMonthLabel : isToday ? 'Today' : formatDate(dateFilter);

  const handleDelete = (pass: DailyPass) => {
    if (!isOwnerOrAdmin) return;
    haptics.warning();
    Alert.alert(
      'Delete Daily Pass',
      `Are you sure you want to delete the daily pass for "${pass.visitor_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('daily_passes').delete().eq('id', pass.id);
              if (error) throw error;
              haptics.success();
              qc.invalidateQueries({ queryKey: ['mobile-daily-passes'] });
              qc.invalidateQueries({ queryKey: ['mobile-daily-passes-today-stats'] });
            } catch (err: unknown) {
              haptics.error();
              Alert.alert('Error', (err as Error).message || 'Failed to delete pass');
            }
          },
        },
      ]
    );
  };

  const formatTime = (ts?: string | null) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '—';
    }
  };

  const renderPassCard = ({ item }: { item: DailyPass }) => {
    const isPaid = item.payment_status === 'PAID';
    const isPending = item.payment_status === 'PENDING';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.passIconBox}>
              <Ticket size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.visitorName} numberOfLines={1}>
                {item.visitor_name}
              </Text>
              <View style={styles.purposeRow}>
                {filterMode === 'month' && (
                  <View style={styles.dateBadge}>
                    <Calendar size={10} color={colors.gold} />
                    <Text style={styles.dateBadgeText}>{formatDate(item.pass_date)}</Text>
                  </View>
                )}
                <View style={styles.purposeBadge}>
                  <Text style={styles.purposeText}>{item.purpose || 'Day Visit'}</Text>
                </View>
                <View style={styles.timeBadge}>
                  <Clock size={11} color={colors.textMuted} />
                  <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <Text style={styles.amountText}>{formatCurrency(Number(item.amount || 100))}</Text>
            <View
              style={[
                styles.statusBadge,
                isPaid
                  ? styles.statusBadgePaid
                  : isPending
                  ? styles.statusBadgePending
                  : styles.statusBadgeWaived,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isPaid
                    ? styles.statusTextPaid
                    : isPending
                    ? styles.statusTextPending
                    : styles.statusTextWaived,
                ]}
              >
                {item.payment_status}
              </Text>
            </View>
          </View>
        </View>

        {/* Details row */}
        <View style={styles.cardDetails}>
          {item.mobile ? (
            <TouchableOpacity
              style={styles.mobileChip}
              onPress={() => Linking.openURL(`tel:${item.mobile}`)}
              activeOpacity={0.7}
            >
              <Phone size={12} color={colors.blueLight} />
              <Text style={styles.mobileText}>{item.mobile}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.methodChip}>
            <Text style={styles.methodText}>{item.payment_method}</Text>
          </View>

          {item.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              Note: {item.notes}
            </Text>
          ) : null}
        </View>

        {/* Actions row for OWNER / ADMIN */}
        {isOwnerOrAdmin && (
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item)}
              activeOpacity={0.7}
            >
              <Trash2 size={14} color={colors.error} />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="DAILY PASS"
        subtitle="Single-Day Facility Access"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => {
              haptics.light();
              setSelectedPass(null);
              setModalVisible(true);
            }}
          >
            <Plus size={20} color={colors.bgPrimary} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={filteredPasses}
        keyExtractor={(item) => item.id}
        renderItem={renderPassCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Stats Banner */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardPasses]}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>
                    {filterMode === 'month' ? `${formattedMonthLabel} PASSES` : 'TODAY PASSES'}
                  </Text>
                  <Users size={14} color={colors.gold} />
                </View>
                <Text style={[styles.statValue, { color: colors.gold }]}>
                  {activeStats.total}
                </Text>
              </View>

              <View style={[styles.statCard, styles.statCardRevenue]}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>
                    {filterMode === 'month' ? `${formattedMonthLabel} REVENUE` : 'TODAY REVENUE'}
                  </Text>
                  <DollarSign size={14} color={colors.success} />
                </View>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {formatCurrency(activeStats.revenue)}
                </Text>
              </View>

              <View style={[styles.statCard, styles.statCardPending]}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>PENDING</Text>
                  <AlertCircle size={14} color={colors.gold} />
                </View>
                <Text style={[styles.statValue, { color: colors.gold }]}>
                  {activeStats.pending}
                </Text>
              </View>
            </View>

            {/* Filter Mode Selector (Day vs Month) */}
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setFilterMode('day');
                }}
                style={[styles.modeTab, filterMode === 'day' && styles.modeTabActive]}
                activeOpacity={0.8}
              >
                <Calendar size={14} color={filterMode === 'day' ? colors.gold : colors.textMuted} />
                <Text
                  style={[styles.modeTabText, filterMode === 'day' && styles.modeTabTextActive]}
                >
                  DAY VIEW
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setFilterMode('month');
                }}
                style={[styles.modeTab, filterMode === 'month' && styles.modeTabActive]}
                activeOpacity={0.8}
              >
                <CalendarDays
                  size={14}
                  color={filterMode === 'month' ? colors.gold : colors.textMuted}
                />
                <Text
                  style={[styles.modeTabText, filterMode === 'month' && styles.modeTabTextActive]}
                >
                  MONTH VIEW
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date / Month Picker Filter Bar */}
            {filterMode === 'day' ? (
              <View style={styles.dateFilterContainer}>
                <TouchableOpacity
                  onPress={handlePrevDay}
                  style={styles.dateArrowBtn}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setShowDatePicker(true);
                  }}
                  style={styles.dateDisplayBtn}
                  activeOpacity={0.8}
                >
                  <Calendar size={15} color={colors.gold} />
                  <Text style={styles.dateDisplayText}>
                    {formatDate(dateFilter)} {isToday && '(Today)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextDay}
                  style={styles.dateArrowBtn}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {!isToday && (
                  <TouchableOpacity
                    onPress={handleToday}
                    style={styles.todayBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.todayBtnText}>TODAY</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.dateFilterContainer}>
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  style={styles.dateArrowBtn}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setShowMonthPicker(true);
                  }}
                  style={styles.dateDisplayBtn}
                  activeOpacity={0.8}
                >
                  <CalendarDays size={15} color={colors.gold} />
                  <Text style={styles.dateDisplayText}>
                    {formattedMonthLabel} {isCurrentMonth && '(This Month)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={styles.dateArrowBtn}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {!isCurrentMonth && (
                  <TouchableOpacity
                    onPress={handleThisMonth}
                    style={styles.todayBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.todayBtnText}>THIS MONTH</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
              <FVEInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search visitor name or phone..."
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  style={styles.clearSearchBtn}
                >
                  <X size={14} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <FVELogoLoader message="Loading daily passes..." />
          ) : (
            <FVEEmptyState
              icon={<Ticket size={48} color={colors.textMuted} />}
              title="No Daily Passes"
              description={
                search
                  ? `No passes found matching "${search}"`
                  : `No daily passes recorded for ${statsPeriodLabel}.`
              }
              actionTitle="Issue Daily Pass"
              onAction={() => {
                setSelectedPass(null);
                setModalVisible(true);
              }}
            />
          )
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Issue New Daily Pass"
        onPress={() => {
          haptics.medium();
          setSelectedPass(null);
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Plus size={20} color="#000000" />
        <Text style={styles.fabText}>ISSUE PASS</Text>
      </TouchableOpacity>

      <DailyPassFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['mobile-daily-passes'] });
          qc.invalidateQueries({ queryKey: ['mobile-daily-passes-today-stats'] });
        }}
        pass={selectedPass}
      />

      {/* Date Picker Modal for Day View */}
      <FVEDatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(d) => setDateFilter(d)}
        initialDate={dateFilter}
        title="SELECT PASS DATE"
      />

      {/* Month Picker Modal for Month View */}
      <FVEMonthPickerModal
        visible={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        onSelectMonth={(m) => setMonthFilter(m)}
        initialMonth={monthFilter}
        title="SELECT PASS MONTH"
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
    },
    headerComponent: {
      paddingVertical: 12,
    },
    headerAddBtn: {
      backgroundColor: colors.gold,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    statCard: {
      flex: 1,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: colors.bgSecondary,
    },
    statCardPasses: {
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : colors.borderDefault,
    },
    statCardRevenue: {
      borderColor: isDark ? 'rgba(34, 197, 94, 0.25)' : colors.borderDefault,
    },
    statCardPending: {
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : colors.borderDefault,
    },
    statHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    statLabel: {
      fontSize: 9,
      fontFamily: typography.fonts.rajdhaniMedium,
      color: colors.textSecondary,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: typography.sizes.lg,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    modeTabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      backgroundColor: colors.bgSecondary,
      padding: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    modeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
    },
    modeTabActive: {
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.15)',
      borderWidth: 1,
      borderColor: colors.gold,
    },
    modeTabText: {
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0.8,
    },
    modeTabTextActive: {
      color: colors.gold,
      fontWeight: '700',
    },
    dateFilterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      backgroundColor: colors.bgSecondary,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    dateArrowBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    dateDisplayBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    dateDisplayText: {
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    todayBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.15)',
      borderWidth: 1,
      borderColor: colors.gold,
    },
    todayBtnText: {
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    searchContainer: {
      position: 'relative',
      marginBottom: 4,
    },
    searchIcon: {
      position: 'absolute',
      left: 12,
      top: 14,
      zIndex: 1,
    },
    searchInput: {
      paddingLeft: 38,
      marginBottom: 0,
    },
    clearSearchBtn: {
      position: 'absolute',
      right: 12,
      top: 14,
      zIndex: 1,
      padding: 4,
    },
    card: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      padding: 14,
      marginBottom: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    passIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : colors.goldBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    visitorName: {
      fontSize: typography.sizes.md,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    purposeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    dateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.08)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : colors.goldBorder,
    },
    dateBadgeText: {
      fontSize: 10,
      fontFamily: typography.fonts.rajdhaniMedium,
      color: colors.gold,
      fontWeight: '700',
    },
    purposeBadge: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    purposeText: {
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      color: colors.textSecondary,
    },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    timeText: {
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      color: colors.textMuted,
    },
    cardHeaderRight: {
      alignItems: 'flex-end',
      marginLeft: 8,
    },
    amountText: {
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      marginTop: 4,
    },
    statusBadgePaid: {
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      borderColor: 'rgba(34, 197, 94, 0.35)',
    },
    statusTextPaid: {
      color: colors.success,
    },
    statusBadgePending: {
      backgroundColor: 'rgba(239, 161, 0, 0.12)',
      borderColor: 'rgba(239, 161, 0, 0.35)',
    },
    statusTextPending: {
      color: colors.gold,
    },
    statusBadgeWaived: {
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      borderColor: 'rgba(148, 163, 184, 0.35)',
    },
    statusTextWaived: {
      color: colors.textMuted,
    },
    statusBadgeText: {
      fontSize: 9,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cardDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    mobileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(0, 102, 255, 0.1)' : 'rgba(0, 102, 255, 0.08)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    mobileText: {
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      color: colors.blueLight,
    },
    methodChip: {
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    methodText: {
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      color: colors.textSecondary,
    },
    notesText: {
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      color: colors.textMuted,
      fontStyle: 'italic',
      flex: 1,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    deleteText: {
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      color: colors.error,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.gold,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 28,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    fabText: {
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: 0.8,
    },
  });
