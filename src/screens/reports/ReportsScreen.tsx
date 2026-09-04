import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  Award,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { getLocalDateStr, getLocalMonthStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function ReportsScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<Period>('monthly');

  // Revenue Inflow Trend Query
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['mobile-revenue-report', period],
    queryFn: async () => {
      const results: { label: string; revenue: number }[] = [];
      const now = new Date();
      const count =
        period === 'daily'
          ? 7
          : period === 'weekly'
          ? 8
          : period === 'monthly'
          ? 6
          : 5;

      for (let i = count - 1; i >= 0; i--) {
        let label = '';
        let startDate = '';
        let endDate = '';

        if (period === 'daily') {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          startDate = endDate = getLocalDateStr(d);
          label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        } else if (period === 'weekly') {
          const d = new Date(now);
          d.setDate(d.getDate() - i * 7);
          const start = new Date(d);
          start.setDate(d.getDate() - d.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          startDate = getLocalDateStr(start);
          endDate = getLocalDateStr(end);
          label = `Wk ${count - i}`;
        } else if (period === 'monthly') {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          const monthStr = getLocalMonthStr(d);
          startDate = `${monthStr}-01`;
          endDate = `${monthStr}-${lastDay}`;
          label = d.toLocaleString('en-IN', { month: 'short' });
        } else {
          const year = now.getFullYear() - i;
          startDate = `${year}-01-01`;
          endDate = `${year}-12-31`;
          label = `${year}`;
        }

        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        const total = (payments || []).reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        );
        results.push({ label, revenue: total });
      }

      const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
      const maxRevenue = Math.max(...results.map(r => r.revenue), 1);

      return {
        bars: results,
        totalRevenue,
        maxRevenue,
        averageRevenue: Math.round(totalRevenue / count),
      };
    },
  });

  // Membership Health Statistics (Active, Expiring Soon, Expired, Total)
  const { data: memberStats } = useQuery({
    queryKey: ['mobile-reports-member-stats'],
    queryFn: async () => {
      const [active, expiring, expired, total] = await Promise.all([
        supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('status', 'EXPIRING_SOON'),
        supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('status', 'EXPIRED'),
        supabase.from('members').select('*', { count: 'exact', head: true }),
      ]);
      return {
        active: active.count || 0,
        expiring: expiring.count || 0,
        expired: expired.count || 0,
        total: total.count || 0,
      };
    },
  });

  // Popular Plans Ranking Query
  const { data: popularPlans } = useQuery({
    queryKey: ['mobile-reports-popular-plans'],
    queryFn: async () => {
      const { data: plans } = await supabase
        .from('membership_plans')
        .select('id, name, price')
        .eq('active', true);

      if (!plans || plans.length === 0) return [];
      const results: { id: string; name: string; price: number; count: number }[] = [];

      for (const plan of plans) {
        const { count } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('plan_id', plan.id);
        results.push({
          id: plan.id,
          name: plan.name,
          price: Number(plan.price || 0),
          count: count || 0,
        });
      }

      return results.sort((a, b) => b.count - a.count).slice(0, 5);
    },
  });

  const handlePeriodChange = (p: Period) => {
    haptics.selection();
    setPeriod(p);
  };

  const maxPlanCount = Math.max(...(popularPlans || []).map(p => p.count), 1);

  return (
    <View style={styles.container}>
      <FVEHeader title="ANALYTICS & REPORTS" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* Period Selector Tabs with Native Ripple */}
        <View style={styles.periodRow}>
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => {
            const isSelected = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => handlePeriodChange(p)}
                android_ripple={{ color: 'rgba(239, 161, 0, 0.2)', borderless: false }}
                style={[styles.periodBtn, isSelected && styles.selectedPeriodBtn]}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    isSelected && styles.selectedPeriodBtnText,
                  ]}
                >
                  {p.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Overview KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PERIOD INFLOW</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(reportData?.totalRevenue || 0)}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AVG / {period.toUpperCase()}</Text>
            <Text style={[styles.kpiValue, { color: colors.blueLight }]}>
              {formatCurrency(reportData?.averageRevenue || 0)}
            </Text>
          </View>
        </View>

        {/* Custom Native Bar Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <BarChart3 size={18} color={colors.gold} />
            <Text style={styles.chartTitle}>REVENUE INFLOW TREND</Text>
          </View>

          <View style={styles.chartContainer}>
            {(reportData?.bars || []).map((item, index) => {
              const max = reportData?.maxRevenue || 1;
              const barHeightPct = Math.max(8, Math.round((item.revenue / max) * 100));

              return (
                <View key={index} style={styles.barColumn}>
                  <Text style={styles.barValueText}>
                    {item.revenue >= 1000
                      ? `₹${Math.round(item.revenue / 1000)}k`
                      : `₹${item.revenue}`}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${barHeightPct}%`,
                          backgroundColor:
                            barHeightPct > 60 ? colors.gold : colors.goldDark,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Membership Health Distribution */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>MEMBERSHIP HEALTH</Text>
          </View>

          <View style={styles.healthGrid}>
            <View style={[styles.healthItem, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={[styles.healthVal, { color: colors.success }]}>
                {memberStats?.active ?? 0}
              </Text>
              <Text style={styles.healthLabel}>ACTIVE</Text>
            </View>

            <View style={[styles.healthItem, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
              <Clock size={16} color="#F59E0B" />
              <Text style={[styles.healthVal, { color: '#F59E0B' }]}>
                {memberStats?.expiring ?? 0}
              </Text>
              <Text style={styles.healthLabel}>EXPIRING</Text>
            </View>

            <View style={[styles.healthItem, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <AlertTriangle size={16} color={colors.error} />
              <Text style={[styles.healthVal, { color: colors.error }]}>
                {memberStats?.expired ?? 0}
              </Text>
              <Text style={styles.healthLabel}>EXPIRED</Text>
            </View>

            <View style={[styles.healthItem, { borderColor: 'rgba(239, 161, 0, 0.3)' }]}>
              <Users size={16} color={colors.gold} />
              <Text style={[styles.healthVal, { color: colors.gold }]}>
                {memberStats?.total ?? 0}
              </Text>
              <Text style={styles.healthLabel}>TOTAL</Text>
            </View>
          </View>
        </View>

        {/* Popular Membership Plans Ranking */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Award size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>POPULAR MEMBERSHIP PLANS</Text>
          </View>

          {(!popularPlans || popularPlans.length === 0) ? (
            <Text style={styles.emptyPlansText}>No active plan subscriptions recorded.</Text>
          ) : (
            popularPlans.map((plan, idx) => {
              const widthPct = Math.max(12, Math.round((plan.count / maxPlanCount) * 100));

              return (
                <View key={plan.id} style={styles.planRankRow}>
                  <View style={styles.planRankTop}>
                    <View style={styles.planNameWrap}>
                      <Text style={styles.planRankBadge}>#{idx + 1}</Text>
                      <Text style={styles.planNameText}>{plan.name}</Text>
                    </View>
                    <Text style={styles.planCountText}>
                      {plan.count} {plan.count === 1 ? 'member' : 'members'}
                    </Text>
                  </View>

                  <View style={styles.planProgressTrack}>
                    <View
                      style={[
                        styles.planProgressFill,
                        {
                          width: `${widthPct}%`,
                          backgroundColor: idx === 0 ? colors.gold : colors.goldMuted,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: '#12161C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectedPeriodBtn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  periodBtnText: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  selectedPeriodBtnText: {
    color: '#050505',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#12161D',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.2)',
    padding: 14,
    borderRadius: 14,
  },
  kpiLabel: {
    fontFamily: typography.fonts.inter,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 20,
    fontWeight: '700',
    color: colors.gold,
  },
  chartCard: {
    backgroundColor: '#12161D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  chartTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
    paddingTop: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontFamily: typography.fonts.inter,
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: 20,
    height: 100,
    backgroundColor: '#161A22',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontFamily: typography.fonts.inter,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: '#12161D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  healthGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  healthItem: {
    flex: 1,
    backgroundColor: '#0E1116',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
  },
  healthVal: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 18,
    fontWeight: '700',
  },
  healthLabel: {
    fontFamily: typography.fonts.inter,
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  emptyPlansText: {
    fontFamily: typography.fonts.inter,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  planRankRow: {
    marginBottom: 12,
  },
  planRankTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  planNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planRankBadge: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  planNameText: {
    fontFamily: typography.fonts.inter,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  planCountText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
  },
  planProgressTrack: {
    height: 6,
    backgroundColor: '#181C24',
    borderRadius: 3,
    overflow: 'hidden',
  },
  planProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
