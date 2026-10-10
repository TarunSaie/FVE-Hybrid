import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
  Share2,
  PauseCircle,
  UserCheck,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { getLocalDateStr, getLocalMonthStr, formatDate, normalizeMembershipStatus } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { shareReportPdf } from '@/utils/reportPdf';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function ReportsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getReportsStyles(colors, isDark), [colors, isDark]);
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
          // Standard 3-letter month abbreviation like "Sep", "Oct", "Nov"
          label = d.toLocaleDateString('en-US', { month: 'short' }).slice(0, 3);
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

  // Attendance Trend (Last 7 Days Check-ins)
  const { data: attendanceTrend } = useQuery({
    queryKey: ['mobile-reports-attendance-trend'],
    queryFn: async () => {
      const results: { label: string; count: number }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateStr(d);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', dateStr);
        results.push({ label, count: count || 0 });
      }
      const maxCount = Math.max(...results.map(r => r.count), 1);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      return { bars: results, maxCount, totalCount };
    },
  });

  // Membership Health Statistics (Active, Expiring Soon, Expired, Hold, Total)
  const { data: memberStats } = useQuery({
    queryKey: ['mobile-reports-member-stats'],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('status, expiry_date');

      if (error) throw error;

      const summary = { active: 0, expiring: 0, expired: 0, hold: 0 };
      for (const ms of memberships || []) {
        const normalized = normalizeMembershipStatus(ms.status, ms.expiry_date);
        if (normalized === 'ACTIVE') summary.active += 1;
        else if (normalized === 'EXPIRING_SOON') summary.expiring += 1;
        else if (normalized === 'EXPIRED') summary.expired += 1;
        else if (normalized === 'HOLD') summary.hold += 1;
      }

      const { count: total } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });

      return {
        active: summary.active,
        expiring: summary.expiring,
        expired: summary.expired,
        hold: summary.hold,
        total: total || 0,
      };
    },
  });

  // Popular Plans Ranking Query
  const { data: popularPlans } = useQuery({
    queryKey: ['mobile-reports-popular-plans'],
    queryFn: async () => {
      const { data: plans } = await supabase
        .from('membership_plans')
        .select('id, name, price, duration_days, duration_type')
        .eq('active', true);

      if (!plans || plans.length === 0) return [];
      const results: {
        id: string;
        name: string;
        price: number;
        duration_days?: number;
        duration_type?: string;
        count: number;
      }[] = [];

      for (const plan of plans) {
        const { count } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('plan_id', plan.id);
        results.push({
          id: plan.id,
          name: plan.name,
          price: Number(plan.price || 0),
          duration_days: plan.duration_days,
          duration_type: plan.duration_type,
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

  const [sharing, setSharing] = useState(false);

  const handleShareReport = async () => {
    if (!reportData) return;
    haptics.medium();
    setSharing(true);
    try {
      const periodMap: Record<Period, string> = {
        daily: 'Daily Performance Report',
        weekly: 'Weekly Performance Report',
        monthly: 'Monthly Performance Report',
        yearly: 'Yearly Performance Report',
      };
      await shareReportPdf({
        periodLabel: periodMap[period],
        generatedDate: formatDate(getLocalDateStr()),
        totalRevenue: reportData.totalRevenue,
        averageRevenue: reportData.averageRevenue,
        bars: reportData.bars,
        memberStats,
        popularPlans,
      });
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Share Error', (err as Error).message || 'Failed to export report');
    } finally {
      setSharing(false);
    }
  };

  const maxPlanCount = Math.max(...(popularPlans || []).map(p => p.count), 1);

  // Lakh / thousand format helper for bar labels
  const formatBarValue = (val: number) => {
    if (val <= 0) return '';
    if (val >= 100000) {
      const l = val / 100000;
      return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
    }
    if (val >= 1000) {
      return `₹${Math.round(val / 1000)}k`;
    }
    return `₹${val}`;
  };

  // Plan duration display helper to distinguish duplicate plan names
  const formatPlanDuration = (days?: number, type?: string) => {
    if (type === 'ANNUAL' || days === 365) return '1 Year';
    if (type === 'QUARTERLY' || days === 90) return '3 Months';
    if (type === 'HALF_YEARLY' || days === 180) return '6 Months';
    if (type === 'MONTHLY' || days === 30) return '1 Month';
    if (days) return `${days} Days`;
    return type ? type.charAt(0) + type.slice(1).toLowerCase() : 'Custom';
  };

  // Stacked bar distribution percentages
  const healthTotal = (memberStats?.active ?? 0) + (memberStats?.expiring ?? 0) + (memberStats?.expired ?? 0) + (memberStats?.hold ?? 0);
  const activePct = healthTotal > 0 ? ((memberStats?.active ?? 0) / healthTotal) * 100 : 0;
  const expiringPct = healthTotal > 0 ? ((memberStats?.expiring ?? 0) / healthTotal) * 100 : 0;
  const expiredPct = healthTotal > 0 ? ((memberStats?.expired ?? 0) / healthTotal) * 100 : 0;
  const holdPct = healthTotal > 0 ? ((memberStats?.hold ?? 0) / healthTotal) * 100 : 0;

  return (
    <View style={styles.container}>
      <FVEHeader
        title="ANALYTICS & REPORTS"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={handleShareReport}
            disabled={sharing || !reportData}
            style={styles.shareBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Export PDF Report"
          >
            {sharing ? (
              <ActivityIndicator size={14} color={colors.gold} />
            ) : (
              <>
                <Share2 size={14} color={colors.gold} />
                <Text style={styles.shareBtnText}>Export PDF</Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

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
        {/* Period Selector Tabs with 44px Height */}
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

        {/* Overview KPI Cards - ~90px Height */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{period.toUpperCase()} INFLOW</Text>
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

        {/* Custom Native Bar Chart - ~200px Height Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <BarChart3 size={17} color={colors.gold} />
            <Text style={styles.chartTitle}>REVENUE INFLOW TREND</Text>
          </View>

          <View style={styles.chartContainer}>
            {(reportData?.bars || []).map((item, index) => {
              const max = reportData?.maxRevenue || 1;
              const hasRev = item.revenue > 0;
              const barHeightPct = hasRev ? Math.max(8, Math.round((item.revenue / max) * 100)) : 0;

              return (
                <View key={index} style={styles.barColumn}>
                  <Text style={styles.barValueText}>
                    {formatBarValue(item.revenue)}
                  </Text>
                  <View style={styles.barTrack}>
                    {hasRev && (
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
                    )}
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Attendance Trend Chart - ~200px Height Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <UserCheck size={17} color={colors.blueLight} />
            <Text style={styles.chartTitle}>ATTENDANCE TREND (7 DAYS)</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.kpiLabel, { color: colors.blueLight, marginBottom: 0 }]}>
              {attendanceTrend?.totalCount || 0} TOTAL
            </Text>
          </View>

          <View style={styles.chartContainer}>
            {(attendanceTrend?.bars || []).map((item, index) => {
              const max = attendanceTrend?.maxCount || 1;
              const hasCount = item.count > 0;
              const barHeightPct = hasCount ? Math.max(8, Math.round((item.count / max) * 100)) : 0;

              return (
                <View key={index} style={styles.barColumn}>
                  <Text style={[styles.barValueText, { color: colors.blueLight }]}>
                    {hasCount ? item.count : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    {hasCount && (
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${barHeightPct}%`,
                            backgroundColor:
                              barHeightPct > 60 ? colors.blueLight : 'rgba(0, 102, 255, 0.45)',
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Membership Health - Compact Stacked Bar & Row */}
        <View style={styles.healthCompactCard}>
          <View style={styles.healthHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Users size={16} color={colors.gold} />
              <Text style={styles.healthCardTitle}>MEMBERSHIP HEALTH</Text>
            </View>
            <Text style={styles.healthTotalBadge}>
              {memberStats?.total ?? 0} MEMBERS TOTAL
            </Text>
          </View>

          {/* Stacked Proportional Bar */}
          <View style={styles.stackedBarContainer}>
            {activePct > 0 && (
              <View style={[styles.stackedSegment, { width: `${activePct}%`, backgroundColor: colors.success }]} />
            )}
            {expiringPct > 0 && (
              <View style={[styles.stackedSegment, { width: `${expiringPct}%`, backgroundColor: '#F59E0B' }]} />
            )}
            {expiredPct > 0 && (
              <View style={[styles.stackedSegment, { width: `${expiredPct}%`, backgroundColor: colors.error }]} />
            )}
            {holdPct > 0 && (
              <View style={[styles.stackedSegment, { width: `${holdPct}%`, backgroundColor: '#C084FC' }]} />
            )}
          </View>

          {/* Compact Single Row of Metrics */}
          <View style={styles.healthMetricRow}>
            <View style={styles.healthPill}>
              <View style={[styles.healthDot, { backgroundColor: colors.success }]} />
              <Text style={styles.healthPillCount}>{memberStats?.active ?? 0}</Text>
              <Text style={styles.healthPillLabel}>Active</Text>
            </View>

            <View style={styles.healthPill}>
              <View style={[styles.healthDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.healthPillCount}>{memberStats?.expiring ?? 0}</Text>
              <Text style={styles.healthPillLabel}>Expiring</Text>
            </View>

            <View style={styles.healthPill}>
              <View style={[styles.healthDot, { backgroundColor: colors.error }]} />
              <Text style={styles.healthPillCount}>{memberStats?.expired ?? 0}</Text>
              <Text style={styles.healthPillLabel}>Expired</Text>
            </View>

            <View style={styles.healthPill}>
              <View style={[styles.healthDot, { backgroundColor: '#C084FC' }]} />
              <Text style={styles.healthPillCount}>{memberStats?.hold ?? 0}</Text>
              <Text style={styles.healthPillLabel}>Hold</Text>
            </View>
          </View>
        </View>

        {/* Popular Membership Plans Ranking - With Duration & Price */}
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
              const durationStr = formatPlanDuration(plan.duration_days, plan.duration_type);

              return (
                <View key={plan.id} style={styles.planRankRow}>
                  <View style={styles.planRankTop}>
                    <View style={styles.planNameWrap}>
                      <Text style={styles.planRankBadge}>#{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planNameText} numberOfLines={1}>{plan.name}</Text>
                        <Text style={styles.planSubMeta}>
                          {durationStr} · {formatCurrency(plan.price)}
                        </Text>
                      </View>
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

const getReportsStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
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
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      height: 44,
      minHeight: 44,
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.2)' : colors.goldBorder,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      height: 90,
      minHeight: 90,
      justifyContent: 'center',
      elevation: isDark ? 0 : 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 3,
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      height: 200,
      minHeight: 200,
      elevation: isDark ? 0 : 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 3,
    },
    chartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    chartTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    chartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 125,
      paddingTop: 6,
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
      marginBottom: 3,
    },
    barTrack: {
      width: 18,
      height: 75,
      backgroundColor: colors.bgTertiary,
      borderRadius: 5,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: 5,
    },
    barLabel: {
      fontFamily: typography.fonts.inter,
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 4,
    },
    // Membership Health Stacked Bar & Compact Row
    healthCompactCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    healthHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    healthCardTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    healthTotalBadge: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.08)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    stackedBarContainer: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.bgTertiary,
      flexDirection: 'row',
      overflow: 'hidden',
      marginBottom: 12,
    },
    stackedSegment: {
      height: '100%',
    },
    healthMetricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    healthPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    healthDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    healthPillCount: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    healthPillLabel: {
      fontFamily: typography.fonts.inter,
      fontSize: 10,
      fontWeight: '500',
      color: colors.textMuted,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      elevation: isDark ? 0 : 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 3,
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
      gap: 8,
      flex: 1,
      marginRight: 8,
    },
    planRankBadge: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(239, 161, 0, 0.12)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    planNameText: {
      fontFamily: typography.fonts.inter,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    planSubMeta: {
      fontFamily: typography.fonts.inter,
      fontSize: 10.5,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: 1,
    },
    planCountText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.gold,
    },
    planProgressTrack: {
      height: 6,
      backgroundColor: colors.bgTertiary,
      borderRadius: 3,
      overflow: 'hidden',
    },
    planProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.1)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    shareBtnText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
  });
