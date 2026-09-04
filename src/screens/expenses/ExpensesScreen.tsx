import React, { useState, useCallback } from 'react';
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
import { Plus, DollarSign, TrendingDown, Trash2, Edit, Filter } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { ExpenseFormModal } from '@/components/features/ExpenseFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { Expense, EXPENSE_CATEGORIES } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate, getLocalMonthStr } from '@/utils/date';

export function ExpensesScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const currentMonth = getLocalMonthStr();

  // Query expenses for current month
  const { data: expenses, isLoading, refetch } = useQuery({
    queryKey: ['mobile-expenses', categoryFilter, currentMonth],
    queryFn: async () => {
      const [year, month] = currentMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

      let q = supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', `${currentMonth}-01`)
        .lte('expense_date', `${currentMonth}-${lastDay}`)
        .order('expense_date', { ascending: false });

      if (categoryFilter) {
        q = q.eq('category', categoryFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Expense[];
    },
  });

  const totalExpenses = (expenses || []).reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mobile-expenses'] });
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
        title="GYM EXPENSES"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={() => {
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

      {/* Total Card */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>THIS MONTH'S EXPENSES</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalExpenses)}</Text>
        </View>
        <TrendingDown size={28} color={colors.error} />
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
      <FlatList
        data={expenses || []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
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
              description="Track rent, maintenance, equipment purchases and bills here."
              actionTitle="+ Record Expense"
              onAction={() => {
                setSelectedExpense(null);
                setShowModal(true);
              }}
            />
          ) : null
        }
      />

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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderRadius: 12,
    margin: 16,
    marginBottom: 10,
    padding: 16,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: colors.error,
    fontSize: typography.sizes.xxl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginTop: 2,
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
