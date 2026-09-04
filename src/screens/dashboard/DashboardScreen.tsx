import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  CreditCard,
  UserCheck,
  AlertTriangle,
  UserPlus,
  QrCode,
  RotateCcw,
  Share2,
  Calendar,
  Award,
  DollarSign,
  BarChart3,
  Shield,
  Bell,
  ChevronRight,
  TrendingUp,
  Activity,
  Sun,
  Moon,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { MemberFormModal } from '@/components/features/MemberFormModal';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { FVEBadge } from '@/components/common/FVEBadge';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, openWhatsAppLink } from '@/utils/format';
import { getLocalDateStr, getLocalMonthStr, formatDate } from '@/utils/date';
import { useRenewalAlerts } from '@/hooks/useRenewalAlerts';
import { useMembershipSync } from '@/hooks/useMembershipSync';
import { useBirthdayAlerts } from '@/hooks/useBirthdayAlerts';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Background renewal, birthday, and status sync
  useRenewalAlerts();
  useMembershipSync();
  useBirthdayAlerts();

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [preselectedMemberId, setPreselectedMemberId] = useState<string | undefined>(undefined);

  const todayStr = getLocalDateStr();
  const currentMonthStr = getLocalMonthStr();

  // Dynamic greeting by time of day
  const greetingTime = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Sun };
    if (hour < 18) return { text: 'Good Afternoon', icon: Sun };
    return { text: 'Good Evening', icon: Moon };
  }, []);

  // Fetch Dashboard Statistics
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['mobile-dashboard-stats', todayStr, currentMonthStr],
    queryFn: async () => {
      const [year, month] = currentMonthStr.split('-');
      const lastDayOfMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const monthStart = `${currentMonthStr}-01`;
      const monthEnd = `${currentMonthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

      const [
        activeRes,
        todayAttRes,
        monthRevenueRes,
        expiringRes,
        holdRes,
        newMembersRes,
      ] = await Promise.all([
        supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .lte('start_date', monthEnd)
          .gte('expiry_date', monthStart)
          .neq('status', 'HOLD'),

        supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', todayStr),

        supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', monthStart)
          .lte('payment_date', monthEnd),

        supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .gte('expiry_date', monthStart)
          .lte('expiry_date', monthEnd),

        supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'HOLD'),

        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .gte('joining_date', monthStart)
          .lte('joining_date', monthEnd),
      ]);

      const totalRevenue = (monthRevenueRes.data || []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      return {
        activeMembers: activeRes.count || 0,
        todayAttendance: todayAttRes.count || 0,
        monthRevenue: totalRevenue,
        expiringCount: expiringRes.count || 0,
        holdCount: holdRes.count || 0,
        newRegistrations: newMembersRes.count || 0,
      };
    },
  });

  // Fetch expiring memberships
  const { data: expiringList } = useQuery({
    queryKey: ['mobile-expiring-memberships', todayStr],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureStr = getLocalDateStr(futureDate);

      const { data } = await supabase
        .from('memberships')
        .select('*, members(id, full_name, mobile, member_id, profile_photo), membership_plans(name)')
        .gte('expiry_date', todayStr)
        .lte('expiry_date', futureStr)
        .neq('status', 'HOLD')
        .order('expiry_date', { ascending: true })
        .limit(10);

      return data || [];
    },
  });

  // Fetch recent payments
  const { data: recentPayments } = useQuery({
    queryKey: ['mobile-recent-payments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payments')
        .select('*, members(full_name, member_id, profile_photo)')
        .order('created_at', { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  // Fetch 7-day attendance trend
  const { data: weeklyAttendance } = useQuery({
    queryKey: ['mobile-weekly-attendance', todayStr],
    queryFn: async () => {
      const days = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dStr = getLocalDateStr(d);
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', dStr);
        days.push({
          day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          date: dStr,
          count: count || 0,
        });
      }
      return days;
    },
  });

  // Unread notifications
  const { data: unreadNotifs } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);
      return count || 0;
    },
  });

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
    qc.invalidateQueries({ queryKey: ['mobile-expiring-memberships'] });
    qc.invalidateQueries({ queryKey: ['mobile-recent-payments'] });
    qc.invalidateQueries({ queryKey: ['mobile-weekly-attendance'] });
    qc.invalidateQueries({ queryKey: ['unread-notifications'] });
  }, [qc]);

  const handleWhatsAppReminder = (
    member: { full_name?: string; mobile?: string | null },
    expiryDate: string,
    planName?: string
  ) => {
    if (!member.mobile) {
      haptics.error();
      Alert.alert('No Mobile Number', 'This member has no recorded mobile phone number.');
      return;
    }
    haptics.medium();
    const daysLeft = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const msg = `Hi ${member.full_name || 'Member'}, your ${planName || 'gym'} membership at FitVerse Elite expires on ${formatDate(expiryDate)} (${daysLeft <= 0 ? 'today' : `in ${daysLeft} days`}). Please renew to continue your training uninterrupted. - FitVerse Elite`;
    openWhatsAppLink(member.mobile, msg);
  };

  const isFinancialVisible = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const maxAttendance = Math.max(...(weeklyAttendance?.map((w) => w.count) || [1]), 1);

  return (
    <View style={styles.container}>
      <FVEHeader
        onNotificationsPress={() => navigation.navigate('Notifications')}
        unreadCount={unreadNotifs || 0}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO EXECUTIVE STATUS BANNER ── */}
        <View style={styles.heroBanner}>
          <View style={styles.heroLeft}>
            <View style={styles.greetingRow}>
              <greetingTime.icon size={15} color={colors.gold} />
              <Text style={styles.greetingTimeText}>{greetingTime.text},</Text>
            </View>
            <Text numberOfLines={1} style={styles.heroUserName}>
              {user?.full_name || user?.username || 'Commander'}
            </Text>

            {/* Pulsing Operations Beacon */}
            <View style={styles.statusBeaconRow}>
              <View style={styles.statusBeaconDot} />
              <Text style={styles.statusBeaconText}>OPERATIONS LIVE · DESK READY</Text>
            </View>
          </View>

          <View style={styles.heroRight}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatarInitial}>
                {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'F'}
              </Text>
            </View>
            <FVEBadge role={user?.role} size="sm" style={{ marginTop: 4 }} />
          </View>
        </View>

        {/* ── QUICK ACTIONS BAR (HORIZONTAL PILLS) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsScroll}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.medium();
              setPreselectedMemberId(undefined);
              setShowMemberModal(true);
            }}
            style={styles.actionPillPrimary}
            activeOpacity={0.85}
          >
            <View style={styles.actionPillIconGold}>
              <UserPlus size={16} color="#050505" strokeWidth={2.5} />
            </View>
            <Text style={styles.actionPillPrimaryText}>+ Member</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.medium();
              setPreselectedMemberId(undefined);
              setShowPaymentModal(true);
            }}
            style={styles.actionPill}
            activeOpacity={0.8}
          >
            <View style={styles.actionPillIconDark}>
              <CreditCard size={16} color={colors.gold} />
            </View>
            <Text style={styles.actionPillText}>+ Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.medium();
              navigation.navigate('QRScanner');
            }}
            style={[styles.actionPill, styles.actionPillBlue]}
            activeOpacity={0.8}
          >
            <View style={styles.actionPillIconBlue}>
              <QrCode size={16} color={colors.blueLight} />
            </View>
            <Text style={[styles.actionPillText, { color: colors.blueLight }]}>Scan Kiosk</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('MembershipPlans');
            }}
            style={styles.actionPill}
            activeOpacity={0.8}
          >
            <View style={styles.actionPillIconDark}>
              <Award size={16} color={colors.gold} />
            </View>
            <Text style={styles.actionPillText}>Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('Expenses');
            }}
            style={styles.actionPill}
            activeOpacity={0.8}
          >
            <View style={styles.actionPillIconDark}>
              <DollarSign size={16} color="#22C55E" />
            </View>
            <Text style={styles.actionPillText}>Expenses</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── BENTO METRICS ARCHITECTURE ── */}

        {/* Primary Bento Hero: Month Revenue (or Total Strength) */}
        {isFinancialVisible ? (
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('Reports');
            }}
            activeOpacity={0.9}
            style={styles.bentoHeroCard}
          >
            <LinearGradient
              colors={['#1E1606', '#12141A', '#0B0D12']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bentoHeroGradient}
            >
              <View style={styles.bentoHeroTopRow}>
                <View style={styles.bentoHeroTag}>
                  <TrendingUp size={13} color={colors.gold} />
                  <Text style={styles.bentoHeroTagText}>MONTH-TO-DATE REVENUE</Text>
                </View>
                <View style={styles.bentoHeroBadge}>
                  <Text style={styles.bentoHeroBadgeText}>
                    {new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase()} PERFORMANCE
                  </Text>
                </View>
              </View>

              <Text style={styles.bentoHeroAmount}>
                {formatCurrency(stats?.monthRevenue || 0)}
              </Text>

              <View style={styles.bentoHeroFooter}>
                <View style={styles.bentoHeroMetaItem}>
                  <Text style={styles.bentoHeroMetaLabel}>Active Members</Text>
                  <Text style={styles.bentoHeroMetaVal}>{stats?.activeMembers || 0}</Text>
                </View>
                <View style={styles.bentoHeroDivider} />
                <View style={styles.bentoHeroMetaItem}>
                  <Text style={styles.bentoHeroMetaLabel}>New Joins</Text>
                  <Text style={styles.bentoHeroMetaVal}>+{stats?.newRegistrations || 0}</Text>
                </View>
                <View style={styles.bentoHeroDivider} />
                <View style={styles.bentoHeroMetaItem}>
                  <Text style={styles.bentoHeroMetaLabel}>Today's Log</Text>
                  <Text style={[styles.bentoHeroMetaVal, { color: colors.blueLight }]}>
                    {stats?.todayAttendance || 0}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          /* Non-owner hero: Gym Strength */
          <View style={styles.bentoHeroCard}>
            <LinearGradient
              colors={['#141720', '#0E1116']}
              style={styles.bentoHeroGradient}
            >
              <View style={styles.bentoHeroTopRow}>
                <View style={styles.bentoHeroTag}>
                  <Users size={13} color={colors.gold} />
                  <Text style={styles.bentoHeroTagText}>ACTIVE GYM STRENGTH</Text>
                </View>
                <Text style={styles.bentoHeroBadgeText}>LIVE ROSTER</Text>
              </View>
              <Text style={styles.bentoHeroAmount}>{stats?.activeMembers || 0} Athletes</Text>
            </LinearGradient>
          </View>
        )}

        {/* Bento Row 2: Today Check-Ins & Expiring This Week */}
        <View style={styles.bentoRow}>
          {/* Today Check-ins */}
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('MainTabs', { screen: 'Attendance' });
            }}
            style={[styles.bentoCard, styles.bentoCardBlue]}
            activeOpacity={0.85}
          >
            <View style={styles.bentoIconHeader}>
              <View style={[styles.bentoIconWrap, { backgroundColor: 'rgba(0, 102, 255, 0.15)' }]}>
                <UserCheck size={18} color={colors.blueLight} />
              </View>
              <View style={styles.bentoLiveBadge}>
                <View style={styles.bentoLiveDot} />
                <Text style={styles.bentoLiveText}>TODAY</Text>
              </View>
            </View>
            <Text style={styles.bentoValue}>{stats?.todayAttendance || 0}</Text>
            <Text style={styles.bentoLabel}>Checked-in Today</Text>
          </TouchableOpacity>

          {/* Expiring Soon */}
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('MainTabs', { screen: 'Members' });
            }}
            style={[styles.bentoCard, styles.bentoCardAmber]}
            activeOpacity={0.85}
          >
            <View style={styles.bentoIconHeader}>
              <View style={[styles.bentoIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <AlertTriangle size={18} color={colors.warning} />
              </View>
              <Text style={styles.bentoAlertCount}>{stats?.expiringCount || 0}</Text>
            </View>
            <Text style={styles.bentoValue}>{stats?.expiringCount || 0}</Text>
            <Text style={styles.bentoLabel}>Expiring in 30 Days</Text>
          </TouchableOpacity>
        </View>

        {/* Bento Row 3: 3-Pill Secondary Stat Strip */}
        <View style={styles.pillStatStrip}>
          <View style={styles.pillStatItem}>
            <RotateCcw size={13} color={colors.textMuted} />
            <Text style={styles.pillStatNum}>{stats?.holdCount || 0}</Text>
            <Text style={styles.pillStatLabel}>On Hold</Text>
          </View>
          <View style={styles.pillStatDivider} />
          <View style={styles.pillStatItem}>
            <UserPlus size={13} color={colors.gold} />
            <Text style={[styles.pillStatNum, { color: colors.gold }]}>
              {stats?.newRegistrations || 0}
            </Text>
            <Text style={styles.pillStatLabel}>Joined</Text>
          </View>
          <View style={styles.pillStatDivider} />
          <View style={styles.pillStatItem}>
            <Users size={13} color={colors.success} />
            <Text style={[styles.pillStatNum, { color: colors.success }]}>
              {stats?.activeMembers || 0}
            </Text>
            <Text style={styles.pillStatLabel}>Active</Text>
          </View>
        </View>

        {/* ── EXPIRING MEMBERS CAROUSEL ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <AlertTriangle size={16} color={colors.warning} />
              <Text style={styles.sectionTitle}>EXPIRING THIS WEEK</Text>
            </View>
            <Text style={styles.sectionBadge}>
              {expiringList?.length || 0} Members
            </Text>
          </View>

          {(!expiringList || expiringList.length === 0) ? (
            <View style={styles.emptyCard}>
              <CheckCircle2 size={24} color={colors.success} style={{ marginBottom: 6 }} />
              <Text style={styles.emptyText}>All memberships healthy for the next 7 days.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.expiringCarousel}
            >
              {expiringList.map((item) => {
                const member = item.members as {
                  id?: string;
                  full_name?: string;
                  mobile?: string | null;
                  member_id?: string | null;
                  profile_photo?: string | null;
                } | null;
                const plan = item.membership_plans as { name?: string } | null;
                const daysLeft = Math.ceil(
                  (new Date(item.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <View key={item.id} style={styles.expiringCard}>
                    <View style={styles.expiringCardTop}>
                      <View style={styles.expiringAvatar}>
                        <Text style={styles.expiringAvatarInitial}>
                          {member?.full_name?.charAt(0) || 'M'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.daysLeftPill,
                          daysLeft <= 1 && styles.daysLeftPillUrgent,
                        ]}
                      >
                        <Text style={styles.daysLeftPillText}>
                          {daysLeft <= 0 ? 'Expires Today' : `${daysLeft}d Left`}
                        </Text>
                      </View>
                    </View>

                    <Text numberOfLines={1} style={styles.expiringCardName}>
                      {member?.full_name || 'Member'}
                    </Text>
                    <Text numberOfLines={1} style={styles.expiringCardPlan}>
                      {plan?.name || 'Membership'}
                    </Text>
                    <Text style={styles.expiringCardDate}>
                      Expires {formatDate(item.expiry_date)}
                    </Text>

                    <View style={styles.expiringCardActions}>
                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          if (member?.id) {
                            setPreselectedMemberId(member.id);
                            setShowPaymentModal(true);
                          }
                        }}
                        style={styles.cardRenewBtn}
                      >
                        <Text style={styles.cardRenewBtnText}>Renew</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          handleWhatsAppReminder(member || {}, item.expiry_date, plan?.name)
                        }
                        style={styles.cardWaBtn}
                      >
                        <Share2 size={14} color="#050505" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── 7-DAY ATTENDANCE TREND (NATIVE VISUALIZER) ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Activity size={16} color={colors.blueLight} />
              <Text style={styles.sectionTitle}>7-DAY ATTENDANCE TREND</Text>
            </View>
            <Text style={styles.sectionBadge}>
              Peak: {maxAttendance} visits
            </Text>
          </View>

          <View style={styles.trendCard}>
            <View style={styles.chartBarsRow}>
              {(weeklyAttendance || []).map((w) => {
                const heightPercent = Math.max((w.count / maxAttendance) * 100, 10);
                const isToday = w.date === todayStr;
                return (
                  <View key={w.date} style={styles.barColumn}>
                    <Text style={[styles.barCountText, isToday && styles.barTodayCount]}>
                      {w.count}
                    </Text>
                    <View style={styles.barTrack}>
                      <LinearGradient
                        colors={
                          isToday
                            ? [colors.goldBright, colors.gold, colors.goldDark]
                            : ['#0077FF', '#0055CC', '#003388']
                        }
                        style={[styles.barFill, { height: `${heightPercent}%` }]}
                      />
                    </View>
                    <Text style={[styles.barDayLabel, isToday && styles.barTodayLabel]}>
                      {w.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── RECENT TRANSACTIONS FEED (NATIVE LIST) ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <CreditCard size={16} color={colors.gold} />
              <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('MainTabs', { screen: 'Payments' })}
            >
              <Text style={styles.seeAllText}>See All ❯</Text>
            </TouchableOpacity>
          </View>

          {(!recentPayments || recentPayments.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent payments recorded.</Text>
            </View>
          ) : (
            recentPayments.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => navigation.navigate('PaymentReceipt', { payment: p })}
                style={styles.recentPayRow}
                activeOpacity={0.7}
              >
                <View style={styles.payIconBox}>
                  <CreditCard size={16} color={colors.gold} />
                </View>

                <View style={styles.payMiddleCol}>
                  <Text numberOfLines={1} style={styles.payMemberName}>
                    {p.members?.full_name || 'Member'}
                  </Text>
                  <Text style={styles.payMeta}>
                    #{p.receipt_number || 'N/A'} · {p.payment_method} · {formatDate(p.payment_date || p.created_at)}
                  </Text>
                </View>

                <View style={styles.payRightCol}>
                  <Text style={styles.payAmountText}>{formatCurrency(p.amount)}</Text>
                  <Text style={styles.payStatusSuccess}>PAID</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Bottom padding for tabbar float */}
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Member Form Modal */}
      <MemberFormModal
        visible={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        onSaved={onRefresh}
      />

      {/* Payment Form Modal */}
      <PaymentFormModal
        visible={showPaymentModal}
        preselectedMemberId={preselectedMemberId}
        onClose={() => {
          setShowPaymentModal(false);
          setPreselectedMemberId(undefined);
        }}
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroLeft: {
    flex: 1,
    marginRight: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greetingTimeText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroUserName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  statusBeaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusBeaconDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  statusBeaconText: {
    color: colors.success,
    fontSize: 9.5,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroRight: {
    alignItems: 'center',
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#151920',
    borderWidth: 1.8,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '800',
  },
  quickActionsScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16,
  },
  actionPillPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  actionPillIconGold: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillPrimaryText: {
    color: '#050505',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  actionPillBlue: {
    borderColor: 'rgba(0, 102, 255, 0.25)',
    backgroundColor: '#0C121E',
  },
  actionPillIconDark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillIconBlue: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 102, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  bentoHeroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  bentoHeroGradient: {
    padding: 20,
  },
  bentoHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bentoHeroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bentoHeroTagText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bentoHeroBadge: {
    backgroundColor: 'rgba(239, 161, 0, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bentoHeroBadgeText: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
  },
  bentoHeroAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bentoHeroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  bentoHeroMetaItem: {
    flex: 1,
    alignItems: 'center',
  },
  bentoHeroMetaLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
  },
  bentoHeroMetaVal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    marginTop: 2,
  },
  bentoHeroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 16,
  },
  bentoCardBlue: {
    borderColor: 'rgba(0, 102, 255, 0.22)',
  },
  bentoCardAmber: {
    borderColor: 'rgba(239, 161, 0, 0.22)',
  },
  bentoIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bentoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 102, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bentoLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.blueLight,
  },
  bentoLiveText: {
    color: colors.blueLight,
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  bentoAlertCount: {
    color: colors.warning,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bentoValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  bentoLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  pillStatStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B0E13',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  pillStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillStatNum: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  pillStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
  },
  pillStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionContainer: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionBadge: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  seeAllText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  expiringCarousel: {
    paddingRight: 16,
    gap: 12,
  },
  expiringCard: {
    width: 175,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
  },
  expiringCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expiringAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiringAvatarInitial: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  daysLeftPill: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  daysLeftPillUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  daysLeftPillText: {
    color: colors.gold,
    fontSize: 9.5,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  expiringCardName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  expiringCardPlan: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 1,
  },
  expiringCardDate: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    marginTop: 3,
    marginBottom: 10,
  },
  expiringCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardRenewBtn: {
    flex: 1,
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  cardRenewBtnText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  cardWaBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendCard: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 18,
  },
  chartBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barCountText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    marginBottom: 6,
  },
  barTodayCount: {
    color: colors.gold,
    fontWeight: '800',
  },
  barTrack: {
    width: 14,
    height: 85,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    marginTop: 8,
  },
  barTodayLabel: {
    color: colors.gold,
    fontWeight: '700',
  },
  recentPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  payIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payMiddleCol: {
    flex: 1,
  },
  payMemberName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  payMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  payRightCol: {
    alignItems: 'flex-end',
  },
  payAmountText: {
    color: colors.gold,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  payStatusSuccess: {
    color: colors.success,
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#0D1014',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.inter,
  },
});
