import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Trash2,
  Edit,
  Filter,
  Search,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { ExpenseFormModal } from '@/components/features/ExpenseFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { Expense, EXPENSE_CATEGORIES } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate, getLocalMonthStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';

export function ExpensesScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();

  const currentMonthStr = getLocalMonthStr();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

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

  const netProfit = monthRevenue - monthTotalExpenses;

  const filteredExpenses = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return expenses || [];
    return (expenses || []).filter(e =>
      (e.description || '').toLowerCase().includes(term) ||
      e.category.toLowerCase().includes(term)
    );
  }, [expenses, debouncedSearch]);

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-expenses'] });
    qc.invalidateQueries({ queryKey: ['mobile-expenses-revenue'] });
    qc.invalidateQueries({ queryKey: ['mobile-expenses-total-pnl'] });
  }, [qc]);

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      'Delete Expense',
      `Remove ${expense.category} expense of ${formatCurrency(expense.amount)}?`,
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
              onRefresh();
            } catch (err: unknown) {
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
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setSelectedExpense(null);
              setShowModal(true);
            }}
            style={styles.addBtn}
          >
            <Plus size={16} color={colors.gold} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
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

        <View style={styles.monthInfoBox}>
          <Calendar size={14} color={colors.gold} style={{ marginRight: 6 }} />
          <Text style={styles.monthInfoText}>{formattedMonthLabel}</Text>
        </View>

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

      {/* 3-Card P&L Summary Grid Matching Web */}
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
          <Text style={styles.pnlSubText}>Monthly Payments</Text>
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
          <Text style={styles.pnlSubText}>Gym Expenditure</Text>
        </View>

        {/* Card 3: NET PROFIT / LOSS */}
        <View style={[styles.pnlCardProfit, netProfit < 0 && styles.pnlCardLoss]}>
          <View style={styles.pnlHeaderRow}>
            <Text style={styles.pnlLabel}>{netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</Text>
            <DollarSign size={14} color={netProfit >= 0 ? colors.gold : colors.error} />
          </View>
          <Text numberOfLines={1} style={[styles.pnlValProfit, netProfit < 0 && { color: colors.error }]}>
            {formatCurrency(Math.abs(netProfit))}
          </Text>
          <Text style={styles.pnlSubText}>{netProfit >= 0 ? 'Surplus' : 'Deficit'}</Text>
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

      {/* Category Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setCategoryFilter('')}
            style={[styles.filterChip, !categoryFilter && styles.selectedFilterChip]}
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
      </View>

      {/* Expenses List */}
      {isLoading ? (
        <FVELogoLoader message="Syncing Expenses..." fullScreen />
      ) : (
        <FlatList
          data={filteredExpenses}
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
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseInfo}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.category}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatDate(item.expense_date)}</Text>
                </View>

                {item.description ? (
                  <Text numberOfLines={2} style={styles.descriptionText}>
                    {item.description}
                  </Text>
                ) : null}
              </View>

              <View style={styles.rightColumn}>
                <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.light();
                      setSelectedExpense(item);
                      setShowModal(true);
                    }}
                    style={styles.iconBtn}
                  >
                    <Edit size={14} color={colors.gold} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={[styles.iconBtn, styles.deleteIconBtn]}
                  >
                    <Trash2 size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <FVEEmptyState
                icon={<DollarSign size={40} color={colors.gold} />}
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
        expense={selectedExpense}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  monthNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0A0D12',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
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
  // 3-Card P&L Grid Styles
  pnlGrid: {
    flexDirection: 'row',
    paddingHorizontal: 14,
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
  },
  pnlCardExpenses: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    borderRadius: 12,
    padding: 10,
  },
  pnlCardProfit: {
    flex: 1,
    backgroundColor: 'rgba(239, 161, 0, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.32)',
    borderRadius: 12,
    padding: 10,
  },
  pnlCardLoss: {
    backgroundColor: 'rgba(239, 68, 68, 0.09)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  pnlHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pnlLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pnlValSuccess: {
    color: colors.success,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  pnlValError: {
    color: '#F87171',
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  pnlValProfit: {
    color: colors.gold,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  pnlSubText: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterChip: {
    backgroundColor: '#12161C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    padding: 16,
    paddingBottom: 40,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  expenseInfo: {
    flex: 1,
    marginRight: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
  },
  descriptionText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.goldMuted,
  },
  deleteIconBtn: {
    backgroundColor: colors.errorMuted,
  },
});
