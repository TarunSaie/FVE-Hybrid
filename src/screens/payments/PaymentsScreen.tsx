import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CreditCard, Filter, X } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { PaymentItem } from '@/components/features/PaymentItem';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { Payment, PAYMENT_METHODS } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency, openWhatsAppLink } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { RootStackParamList } from '@/navigation/types';

import { haptics } from '@/utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PaymentsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const [showPayModal, setShowPayModal] = useState(false);

  // Query Payments with Joined Members
  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['mobile-payments', debouncedSearch, methodFilter],
    queryFn: async () => {
      const term = debouncedSearch.trim();
      let memberIds: string[] = [];

      if (term) {
        const { data: matchedMembers } = await supabase
          .from('members')
          .select('id')
          .or(`full_name.ilike.%${term}%,member_id.ilike.%${term}%,mobile.ilike.%${term}%`);

        if (matchedMembers && matchedMembers.length > 0) {
          memberIds = matchedMembers.map((m) => m.id);
        }
      }

      let q = supabase
        .from('payments')
        .select('*, members(full_name, mobile, member_id, profile_photo), memberships(id, start_date, expiry_date, membership_plans(name))')
        .order('created_at', { ascending: false });

      if (methodFilter) {
        q = q.eq('payment_method', methodFilter);
      }

      if (term) {
        if (memberIds.length > 0) {
          q = q.or(
            `receipt_number.ilike.%${term}%,transaction_reference.ilike.%${term}%,member_id.in.(${memberIds.join(',')})`
          );
        } else {
          q = q.or(
            `receipt_number.ilike.%${term}%,transaction_reference.ilike.%${term}%`
          );
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Payment[];
    },
  });

  // Calculate filtered revenue
  const totalRevenue = (payments || []).reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-payments'] });
  }, [qc]);

  const handleMethodSelect = (method: string) => {
    haptics.selection();
    setMethodFilter(method);
  };

  const handleShareWhatsApp = (p: Payment) => {
    const memberName = p.members?.full_name || 'Member';
    const mobile = p.members?.mobile;
    const planName = p.memberships?.membership_plans?.name || 'Membership';
    const text = `*FitVerse Elite Official Receipt*\nReceipt No: #${p.receipt_number || 'N/A'}\nMember: ${memberName}${p.members?.member_id ? ` (${p.members.member_id})` : ''}\nPlan: ${planName}\nAmount Paid: ${formatCurrency(p.amount)}\nPayment Method: ${p.payment_method}\nDate: ${formatDate(p.payment_date || p.created_at)}\n\n*DISCIPLINE • STRENGTH • TRANSFORMATION*\nFitVerse Elite Gym`;

    if (mobile) {
      openWhatsAppLink(mobile, text);
    } else {
      openWhatsAppLink('91', text);
    }
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="PAYMENTS"
        subtitle={`${payments?.length || 0} transactions`}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowPayModal(true);
            }}
            style={styles.addHeaderBtn}
          >
            <Plus size={16} color={colors.gold} />
            <Text style={styles.addHeaderBtnText}>New</Text>
          </TouchableOpacity>
        }
      />

      {/* Revenue Header Card */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>TOTAL REVENUE</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalRevenue)}</Text>
        </View>
        <View style={styles.recordCountBox}>
          <Text style={styles.recordCountText}>
            {payments?.length || 0} Records
          </Text>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={styles.filterSection}>
        <FVEInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by member, ID, receipt no..."
          leftIcon={<Search size={16} color={colors.gold} />}
          rightIcon={
            search ? <X size={16} color={colors.textSecondary} /> : undefined
          }
          onRightIconPress={() => setSearch('')}
          containerStyle={{ marginBottom: 10 }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => handleMethodSelect('')}
            style={[styles.filterChip, !methodFilter && styles.selectedFilterChip]}
          >
            <Text style={[styles.filterChipText, !methodFilter && styles.selectedFilterChipText]}>
              All Methods
            </Text>
          </TouchableOpacity>

          {PAYMENT_METHODS.map(m => {
            const isSelected = methodFilter === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => handleMethodSelect(m)}
                style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.selectedFilterChipText]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Payments List */}
      <FlatList
        data={payments || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PaymentItem
            payment={item}
            onPress={() => navigation.navigate('PaymentReceipt', { payment: item })}
            onShareWhatsApp={() => handleShareWhatsApp(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
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
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<CreditCard size={40} color={colors.gold} />}
              title="No Payments Found"
              description="Payments will show up here once processed."
              actionTitle="+ Record Payment"
              onAction={() => setShowPayModal(true)}
            />
          ) : null
        }
      />

      {/* Native Floating Action Button (FAB) */}
      <TouchableOpacity
        onPress={() => {
          haptics.medium();
          setShowPayModal(true);
        }}
        activeOpacity={0.85}
        style={styles.fab}
      >
        <LinearGradient
          colors={[colors.goldBright, colors.gold, colors.goldDark]}
          style={styles.fabGradient}
        >
          <Plus size={24} color="#050505" strokeWidth={3} />
        </LinearGradient>
      </TouchableOpacity>

      {/* New Payment Modal */}
      <PaymentFormModal
        visible={showPayModal}
        onClose={() => setShowPayModal(false)}
        onSaved={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  addHeaderBtn: {
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
  addHeaderBtnText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    margin: 16,
    marginBottom: 10,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: colors.gold,
    fontSize: typography.sizes.xxl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    marginTop: 2,
  },
  recordCountBox: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordCountText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterChip: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  selectedFilterChip: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderColor: 'rgba(239, 161, 0, 0.35)',
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
    paddingBottom: 110,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    borderRadius: 30,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
