import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Award,
  Users,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { getLocalMonthStr } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PlanDistributionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const currentMonthStr = getLocalMonthStr();
  const [filterMonth, setFilterMonth] = useState(() => getLocalMonthStr());

  const formattedMonthLabel = useMemo(() => {
    if (!filterMonth) return '';
    const [y, m] = filterMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }, [filterMonth]);

  const handlePrevMonth = () => {
    haptics.light();
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setFilterMonth(getLocalMonthStr(d));
  };

  const handleNextMonth = () => {
    if (filterMonth >= currentMonthStr) return;
    haptics.light();
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setFilterMonth(getLocalMonthStr(d));
  };

  const { data: planDistribution = [], isLoading, refetch } = useQuery({
    queryKey: ['mobile-plan-distribution-screen', filterMonth],
    queryFn: async () => {
      const [year, month] = filterMonth.split('-');
      const lastDayOfMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const monthStart = `${filterMonth}-01`;
      const monthEnd = `${filterMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

      // 1. Fetch plans
      const { data: plans } = await supabase
        .from('membership_plans')
        .select('id, name, price');
      const planMap = new Map<string, string>();
      (plans || []).forEach((p) => {
        if (p.id && p.name) planMap.set(p.id, p.name);
      });

      // 2. Fetch memberships
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('id, member_id, plan_id, start_date, expiry_date, status, created_at, membership_plans(id, name)')
        .lte('start_date', monthEnd)
        .gte('expiry_date', monthStart)
        .neq('status', 'HOLD')
        .limit(5000);

      if (error) {
        console.error('Error fetching plan distribution:', error);
        return [];
      }

      // Deduplicate by member_id
      const latestByMember = new Map<string, (typeof memberships)[0]>();
      for (const m of memberships || []) {
        const key = m.member_id || m.id;
        if (!key) continue;
        const existing = latestByMember.get(key);
        if (!existing) {
          latestByMember.set(key, m);
        } else {
          const mExp = m.expiry_date || '';
          const exExp = existing.expiry_date || '';
          if (mExp > exExp || (mExp === exExp && (m.created_at || '') > (existing.created_at || ''))) {
            latestByMember.set(key, m);
          }
        }
      }

      // Tally active athletes by plan name
      const countsByPlan: Record<string, number> = {};
      for (const m of latestByMember.values()) {
        const planObj = Array.isArray(m.membership_plans)
          ? m.membership_plans[0]
          : m.membership_plans;
        const planName =
          planObj?.name ||
          (m.plan_id ? planMap.get(m.plan_id) : null) ||
          'Standard Plan';
        countsByPlan[planName] = (countsByPlan[planName] || 0) + 1;
      }

      const total = Object.values(countsByPlan).reduce((sum, c) => sum + c, 0);

      return Object.entries(countsByPlan)
        .map(([name, count]) => ({
          name,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const totalAthletes = useMemo(() => {
    return planDistribution.reduce((acc, p) => acc + p.count, 0);
  }, [planDistribution]);

  const maxCount = useMemo(() => {
    return Math.max(...planDistribution.map((p) => p.count), 1);
  }, [planDistribution]);

  const barColors = [
    colors.gold,
    colors.blueLight,
    colors.success,
    '#A855F7',
    '#EC4899',
    '#06B6D4',
    colors.warning,
  ];

  return (
    <View style={styles.container}>
      <FVEHeader
        title="PLAN DISTRIBUTION"
        subtitle="Membership Tier Breakdown"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              haptics.light();
              refetch();
            }}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Month Selector Bar */}
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={styles.monthArrow}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={20} color={colors.gold} />
          </TouchableOpacity>

          <View style={styles.monthLabelWrap}>
            <Calendar size={14} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={styles.monthLabelText}>{formattedMonthLabel}</Text>
          </View>

          <TouchableOpacity
            onPress={handleNextMonth}
            disabled={filterMonth >= currentMonthStr}
            style={[styles.monthArrow, filterMonth >= currentMonthStr && { opacity: 0.3 }]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <ChevronRight
              size={20}
              color={filterMonth >= currentMonthStr ? colors.textMuted : colors.gold}
            />
          </TouchableOpacity>
        </View>

        {/* Total Summary Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIconPill}>
              <Users size={18} color={colors.gold} />
            </View>
            <Text style={styles.summaryLabel}>ACTIVE ATHLETES</Text>
          </View>
          <Text style={styles.summaryValue}>{totalAthletes}</Text>
          <Text style={styles.summarySub}>
            Spread across {planDistribution.length} active membership tiers
          </Text>
        </View>

        {/* Plan Breakdown List */}
        {isLoading && planDistribution.length === 0 ? (
          <FVELogoLoader message="Calculating distribution..." />
        ) : planDistribution.length === 0 ? (
          <View style={styles.emptyCard}>
            <Layers size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No active memberships in {formattedMonthLabel}.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {planDistribution.map((plan, index) => {
              const barColor = barColors[index % barColors.length];
              const fillWidth = Math.max((plan.count / maxCount) * 100, 8);

              return (
                <View key={plan.name} style={styles.planRow}>
                  <View style={styles.planHeader}>
                    <View style={styles.planTitleCol}>
                      <Text numberOfLines={1} style={styles.planName}>
                        {plan.name}
                      </Text>
                      <Text style={styles.planMeta}>
                        {plan.count} athletes · {plan.percentage}% of active base
                      </Text>
                    </View>
                    <Text style={[styles.planCountBadge, { color: barColor }]}>
                      {plan.count}
                    </Text>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${fillWidth}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Quick link to manage plans */}
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            navigation.navigate('MembershipPlans');
          }}
          style={styles.managePlansBtn}
          accessibilityRole="button"
          accessibilityLabel="Manage membership plans"
        >
          <Award size={16} color={colors.gold} />
          <Text style={styles.managePlansBtnText}>Manage Membership Plans</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },
    monthSelectorBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    monthArrow: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    monthLabelText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    summaryCard: {
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    summaryTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    summaryIconPill: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    summaryValue: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summarySub: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    listContainer: {
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginBottom: 16,
    },
    planRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    planTitleCol: {
      flex: 1,
      marginRight: 10,
    },
    planName: {
      fontFamily: typography.fonts.inter,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    planMeta: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    planCountBadge: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 18,
      fontWeight: '700',
    },
    progressBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? '#1E2330' : '#E2E8F0',
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    emptyCard: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    emptyText: {
      fontFamily: typography.fonts.inter,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    managePlansBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.08)' : '#FFFBEB',
      minHeight: 48,
    },
    managePlansBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 14,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
  });
