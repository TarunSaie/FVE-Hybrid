import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  TrendingDown,
  TrendingUp,
  Search,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  IndianRupee,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { ExpenseFormModal } from '@/components/features/ExpenseFormModal';
import { FVEMonthPickerModal } from '@/components/common/FVEMonthPickerModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { Expense, EXPENSE_CATEGORIES } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate, getLocalDateStr, getLocalMonthStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { shareMonthlyExpensePdf, shareMonthlyExpenseSheet } from '@/utils/expensePdf';

export function ExpensesScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getExpensesStyles(colors, isDark), [colors, isDark]);

  const { user } = useAuth();
  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(user?.role || '');

  const currentMonthStr = getLocalMonthStr();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search 400ms
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Month navigation
  const formattedMonthLabel = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }, [selectedMonth]);

  const handlePrevMonth = () => {
    haptics.light();
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(getLocalMonthStr(d));
  };

  const handleNextMonth = () => {
    if (selectedMonth >= currentMonthStr) return;
    haptics.light();
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(getLocalMonthStr(d));
  };

  const handleCurrentMonth = () => {
    haptics.medium();
    setSelectedMonth(currentMonthStr);
  };

  // 1. Query expenses for selected month & category
  const { data: expenses, isLoading, refetch } = useQuery({
    queryKey: ['mobile-expenses', categoryFilter, selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

      let q = supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', `${selectedMonth}-01`)
        .lte('expense_date', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`)
        .order('expense_date', { ascending: false });

      if (categoryFilter) {
        q = q.eq('category', categoryFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Expense[];
    },
  });

  // 2. Query Revenue for selected month (from payments table)
  const { data: monthRevenue = 0 } = useQuery({
    queryKey: ['mobile-expenses-revenue', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', `${selectedMonth}-01`)
        .lte('payment_date', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
      if (error) throw error;
      return (data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    },
  });

  // 3. Query Total Expenses for selected month (unfiltered by category for accurate P&L)
  const { data: monthTotalExpenses = 0 } = useQuery({
    queryKey: ['mobile-expenses-total-pnl', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', `${selectedMonth}-01`)
        .lte('expense_date', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
      if (error) throw error;
      return (data || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    },
  });

  // 4. Query all month expenses unfiltered by category for complete P&L reports
  const { data: allMonthExpenses } = useQuery({
    queryKey: ['mobile-all-month-expenses', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', `${selectedMonth}-01`)
        .lte('expense_date', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`)
        .order('expense_date', { ascending: true });
      if (error) throw error;
      return (data || []) as Expense[];
    },
  });

  const netProfit = monthRevenue - monthTotalExpenses;

  const filteredExpenses = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return expenses || [];
    return (expenses || []).filter(e =>
      (e.description || '').toLowerCase().includes(term) ||
      e.category.toLowerCase().includes(term)
    );
  }, [expenses, debouncedSearch]);

  // Group filtered expenses into sections by date
  const expenseSections = useMemo(() => {
    const map = new Map<string, { date: string; dayTotal: number; data: Expense[] }>();
    for (const exp of filteredExpenses) {
      const dateKey = exp.expense_date || getLocalDateStr();
      if (!map.has(dateKey)) {
        map.set(dateKey, { date: dateKey, dayTotal: 0, data: [] });
      }
      const group = map.get(dateKey)!;
      group.data.push(exp);
      group.dayTotal += Number(exp.amount || 0);
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    const today = getLocalDateStr();
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return getLocalDateStr(d);
    })();

    return sortedDates.map(dateKey => {
      const group = map.get(dateKey)!;
      let title = formatDate(dateKey);
      if (dateKey === today) title = 'Today';
      else if (dateKey === yesterday) title = 'Yesterday';

      return {
        title,
        date: dateKey,
        dayTotal: group.dayTotal,
        data: group.data,
      };
    });
  }, [filteredExpenses]);

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-expenses'] });
    qc.invalidateQueries({ queryKey: ['mobile-expenses-revenue'] });
    qc.invalidateQueries({ queryKey: ['mobile-expenses-total-pnl'] });
    qc.invalidateQueries({ queryKey: ['mobile-all-month-expenses'] });
  }, [qc]);

  const handleExportPdf = async () => {
    haptics.medium();
    setExporting(true);
    try {
      const dataToExport = allMonthExpenses || expenses || [];
      await shareMonthlyExpensePdf({
        monthStr: selectedMonth,
        monthLabel: formattedMonthLabel,
        revenue: monthRevenue,
        totalExpenses: monthTotalExpenses,
        profit: netProfit,
        expenses: dataToExport,
        generatedDate: formatDate(getLocalDateStr()),
      });
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Export Error', (err as Error).message || 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSheet = async () => {
    haptics.medium();
    setExporting(true);
    try {
      const dataToExport = allMonthExpenses || expenses || [];
      await shareMonthlyExpenseSheet({
        monthStr: selectedMonth,
        monthLabel: formattedMonthLabel,
        revenue: monthRevenue,
        totalExpenses: monthTotalExpenses,
        profit: netProfit,
        expenses: dataToExport,
        generatedDate: formatDate(getLocalDateStr()),
      });
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Export Error', (err as Error).message || 'Failed to export sheet');
    } finally {
      setExporting(false);
    }
  };

  const handleExportMenuPress = () => {
    haptics.light();
    Alert.alert(
      'Export Expense Report',
      `Select format for ${formattedMonthLabel}:`,
      [
        {
          text: 'PDF Statement (P&L)',
          onPress: handleExportPdf,
        },
        {
          text: 'Excel / CSV Sheet',
          onPress: handleExportSheet,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete ${expense.category} expense of ${formatCurrency(expense.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', expense.id);
              if (error) throw error;
              haptics.success();
              onRefresh();
            } catch (err: unknown) {
              haptics.error();
              Alert.alert('Error', (err as Error).message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="GYM EXPENSES & P&L"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerRightRow}>
            {isOwnerOrAdmin && (
              <TouchableOpacity
                onPress={handleExportMenuPress}
                disabled={exporting}
                style={styles.moreMenuBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Export options menu"
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <MoreVertical size={20} color={colors.gold} />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setSelectedExpense(null);
                setShowModal(true);
              }}
              style={styles.primaryAddBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Record new expense"
            >
              <Plus size={16} color="#050505" strokeWidth={2.5} />
              <Text style={styles.primaryAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Month Navigation Toolbar */}
      <View style={styles.monthNavBar}>
        <TouchableOpacity
          onPress={handlePrevMonth}
          style={styles.monthNavBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={colors.gold} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setShowMonthPicker(true);
          }}
          style={styles.monthInfoBox}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Calendar size={14} color={colors.gold} style={{ marginRight: 6 }} />
          <Text style={styles.monthInfoText}>{formattedMonthLabel}</Text>
        </TouchableOpacity>

        <View style={styles.monthNavRight}>
          {selectedMonth !== currentMonthStr && (
            <TouchableOpacity onPress={handleCurrentMonth} style={styles.currentMonthPill}>
              <Text style={styles.currentMonthPillText}>THIS MONTH</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNextMonth}
            disabled={selectedMonth >= currentMonthStr}
            style={[styles.monthNavBtn, selectedMonth >= currentMonthStr && styles.monthNavBtnDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight
              size={18}
              color={selectedMonth >= currentMonthStr ? colors.textMuted : colors.gold}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3-Card P&L Summary Grid: One Label Each, ₹ Icon, Aligned Margins */}
      <View style={styles.pnlGrid}>
        {/* Card 1: REVENUE */}
        <View style={styles.pnlCardRevenue}>
          <View style={styles.pnlHeaderRow}>
            <Text style={styles.pnlLabel}>REVENUE</Text>
            <TrendingUp size={14} color={colors.success} />
          </View>
          <Text numberOfLines={1} style={styles.pnlValSuccess}>
            {formatCurrency(monthRevenue)}
          </Text>
        </View>

        {/* Card 2: EXPENSES */}
        <View style={styles.pnlCardExpenses}>
          <View style={styles.pnlHeaderRow}>
            <Text style={styles.pnlLabel}>EXPENSES</Text>
            <TrendingDown size={14} color={colors.error} />
          </View>
          <Text numberOfLines={1} style={styles.pnlValError}>
            {formatCurrency(monthTotalExpenses)}
          </Text>
        </View>

        {/* Card 3: NET PROFIT / NET LOSS (by sign) */}
        <View style={[styles.pnlCardProfit, netProfit < 0 && styles.pnlCardLoss]}>
          <View style={styles.pnlHeaderRow}>
            <Text style={styles.pnlLabel}>
              {netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
            </Text>
            <IndianRupee size={13} color={netProfit >= 0 ? colors.gold : colors.error} />
          </View>
          <Text numberOfLines={1} style={[styles.pnlValProfit, netProfit < 0 && { color: colors.error }]}>
            {formatCurrency(Math.abs(netProfit))}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FVEInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by category or description..."
          leftIcon={<Search size={16} color={colors.gold} />}
          rightIcon={search ? <X size={16} color={colors.textSecondary} /> : undefined}
          onRightIconPress={() => setSearch('')}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Category Filter Chips with Fade Edge */}
      <View style={styles.filterSection}>
        <View style={styles.chipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            fadingEdgeLength={36}
            contentContainerStyle={styles.chipScrollContent}
          >
            <TouchableOpacity
              onPress={() => setCategoryFilter('')}
              style={[styles.filterChip, !categoryFilter && styles.selectedFilterChip]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !categoryFilter && styles.selectedFilterChipText,
                ]}
              >
                All Categories
              </Text>
            </TouchableOpacity>

            {EXPENSE_CATEGORIES.map(cat => {
              const isSelected = categoryFilter === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategoryFilter(cat)}
                  style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.selectedFilterChipText,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.chipEdgeFade} pointerEvents="none" />
        </View>
      </View>

      {/* Compact Expense List Grouped by Date */}
      {isLoading ? (
        <FVELogoLoader message="Syncing Expenses..." fullScreen />
      ) : (
        <SectionList
          sections={expenseSections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.dateSectionHeader}>
              <Text style={styles.dateSectionTitle}>{section.title}</Text>
              <Text style={styles.dateSectionTotal}>
                {formatCurrency(section.dayTotal)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                haptics.light();
                setSelectedExpense(item);
                setShowModal(true);
              }}
              onLongPress={() => {
                haptics.medium();
                handleDelete(item);
              }}
              style={styles.compactRow}
              accessibilityRole="button"
              accessibilityLabel={`${item.category} expense: ${formatCurrency(item.amount)}. Tap to edit, long press to delete.`}
            >
              <View style={styles.rowLeftCol}>
                <View style={styles.compactCategoryBadge}>
                  <Text style={styles.compactCategoryText}>{item.category}</Text>
                </View>
                {item.description ? (
                  <Text numberOfLines={1} style={styles.compactDescText}>
                    {item.description}
                  </Text>
                ) : null}
              </View>

              <View style={styles.rowRightCol}>
                <Text style={styles.compactAmountText}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <FVEEmptyState
                icon={<IndianRupee size={40} color={colors.gold} />}
                title="No Expenses Recorded"
                description={`No expenses recorded for ${formattedMonthLabel}.`}
                actionTitle="+ Record Expense"
                onAction={() => {
                  setSelectedExpense(null);
                  setShowModal(true);
                }}
              />
            ) : null
          }
        />
      )}

      <ExpenseFormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={onRefresh}
        onDelete={handleDelete}
        expense={selectedExpense}
      />

      <FVEMonthPickerModal
        visible={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        initialMonth={selectedMonth}
        onSelectMonth={m => {
          setSelectedMonth(m);
          setShowMonthPicker(false);
        }}
        title="SELECT EXPENSE MONTH"
      />
    </View>
  );
}

const getExpensesStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    moreMenuBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.08)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.gold,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
    },
    primaryAddBtnText: {
      color: '#050505',
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    monthNavBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDark,
    },
    monthNavBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.1)' : 'rgba(217, 130, 0, 0.1)',
    },
    monthNavBtnDisabled: {
      opacity: 0.35,
    },
    monthInfoBox: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    monthInfoText: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    monthNavRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    currentMonthPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.gold,
    },
    currentMonthPillText: {
      color: '#050505',
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    // 3-Card P&L Grid Styles - Margins aligned to 16px, Single Label Each
    pnlGrid: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
      gap: 8,
    },
    pnlCardRevenue: {
      flex: 1,
      backgroundColor: 'rgba(34, 197, 94, 0.07)',
      borderWidth: 1,
      borderColor: 'rgba(34, 197, 94, 0.28)',
      borderRadius: 12,
      padding: 10,
      justifyContent: 'center',
    },
    pnlCardExpenses: {
      flex: 1,
      backgroundColor: 'rgba(239, 68, 68, 0.07)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.28)',
      borderRadius: 12,
      padding: 10,
      justifyContent: 'center',
    },
    pnlCardProfit: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.07)' : 'rgba(217, 130, 0, 0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.32)' : 'rgba(217, 130, 0, 0.3)',
      borderRadius: 12,
      padding: 10,
      justifyContent: 'center',
    },
    pnlCardLoss: {
      backgroundColor: 'rgba(239, 68, 68, 0.09)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    pnlHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    pnlLabel: {
      color: colors.textMuted,
      fontSize: 9.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    pnlValSuccess: {
      color: '#16A34A',
      fontSize: 16,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    pnlValError: {
      color: '#DC2626',
      fontSize: 16,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    pnlValProfit: {
      color: colors.gold,
      fontSize: 16,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    filterSection: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    chipRowWrap: {
      position: 'relative',
    },
    chipScrollContent: {
      paddingRight: 24,
    },
    chipEdgeFade: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 20,
      backgroundColor: colors.background,
      opacity: 0.6,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
    },
    selectedFilterChip: {
      backgroundColor: colors.goldMuted,
      borderColor: colors.gold,
    },
    filterChipText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    selectedFilterChipText: {
      color: colors.gold,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    dateSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      marginTop: 8,
    },
    dateSectionTitle: {
      color: colors.textMuted,
      fontSize: 10.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    dateSectionTotal: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      paddingHorizontal: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      minHeight: 48,
    },
    rowLeftCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 12,
    },
    compactCategoryBadge: {
      backgroundColor: colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    compactCategoryText: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    compactDescText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: typography.fonts.inter,
      flexShrink: 1,
    },
    rowRightCol: {
      alignItems: 'flex-end',
    },
    compactAmountText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
  });
