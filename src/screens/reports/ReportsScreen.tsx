import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, DollarSign, Calendar } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { getLocalDateStr, getLocalMonthStr } from '@/utils/date';

type Period = 'daily' | 'weekly' | 'monthly';

export function ReportsScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<Period>('monthly');

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['mobile-revenue-report', period],
    queryFn: async () => {
      const results: { label: string; revenue: number }[] = [];
      const now = new Date();
      const count = period === 'daily' ? 7 : period === 'weekly' ? 8 : 6;

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
        } else {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          const monthStr = getLocalMonthStr(d);
          startDate = `${monthStr}-01`;
          endDate = `${monthStr}-${lastDay}`;
          label = d.toLocaleString('en-IN', { month: 'short' });
        }

        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        const total = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
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
        {/* Period Selector Tabs */}
        <View style={styles.periodRow}>
          {(['daily', 'weekly', 'monthly'] as const).map(p => {
            const isSelected = period === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
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
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Overview KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL INFLOW</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(reportData?.totalRevenue || 0)}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AVERAGE / PERIOD</Text>
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
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: '#12161C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  selectedPeriodBtn: {
    backgroundColor: colors.goldMuted,
    borderColor: colors.gold,
  },
  periodBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  selectedPeriodBtnText: {
    color: colors.gold,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 12,
    padding: 14,
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  kpiValue: {
    color: colors.gold,
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderRadius: 14,
    padding: 18,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    paddingTop: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: typography.fonts.inter,
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginTop: 8,
  },
});
