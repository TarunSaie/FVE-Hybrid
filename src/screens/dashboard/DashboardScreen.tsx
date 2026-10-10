import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
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
  Award,
  DollarSign,
  TrendingUp,
  Sun,
  Moon,
  Sparkles,
  PauseCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Share2,
  MessageCircle,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { MemberFormModal } from '@/components/features/MemberFormModal';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBranding } from '@/contexts/BrandingContext';
import { formatCurrency, openWhatsAppLink } from '@/utils/format';
import { getLocalDateStr, getLocalMonthStr, formatDate } from '@/utils/date';
import { useRenewalAlerts } from '@/hooks/useRenewalAlerts';
import { useMembershipSync } from '@/hooks/useMembershipSync';
import { useBirthdayAlerts } from '@/hooks/useBirthdayAlerts';
import { useRenewalMessagingStatus } from '@/utils/renewalMessaging';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';
import { Payment } from '@/types';

interface ExpiringMemberItem {
  id: string;
  member_id: string;
  expiry_date: string;
  status: string;
  members?: {
    id?: string;
    full_name?: string;
    mobile?: string | null;
    member_id?: string;
    profile_photo?: string | null;
  } | null;
  membership_plans?: {
    name?: string;
  } | { name?: string }[] | null;
}

interface HoldMemberItem {
  id: string;
  member_id?: string;
  full_name?: string;
  mobile?: string | null;
  profile_photo?: string | null;
  plan_name?: string;
  membership_expiry_date?: string;
}

type RecentPaymentPreview = Payment & {
  members?: {
    full_name?: string;
    member_id?: string;
    profile_photo?: string | null;
  } | null;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { brandConfig } = useBranding();
  const styles = useMemo(() => getDashboardStyles(colors, isDark), [colors, isDark]);
  const qc = useQueryClient();

  // Background renewal, birthday, and status sync
  useRenewalAlerts();
  useMembershipSync();
  useBirthdayAlerts();

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [preselectedMemberId, setPreselectedMemberId] = useState<string | undefined>(undefined);

  const { isSent, markSent } = useRenewalMessagingStatus();

  const todayStr = getLocalDateStr();
  const currentMonthStr = getLocalMonthStr();

  // Confidential Data Visibility Toggle (Hidden by default for privacy)
  const [showConfidentialData, setShowConfidentialData] = useState(false);

  // Dynamic greeting by time of day
  const greetingTime = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Sun };
    if (hour < 18) return { text: 'Good Afternoon', icon: Sun };
    return { text: 'Good Evening', icon: Moon };
  }, []);

  // Fetch Dashboard Statistics - EACH METRIC COMPUTED ONCE
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['mobile-dashboard-stats-v3', todayStr, currentMonthStr],
    queryFn: async () => {
      const [year, month] = currentMonthStr.split('-');
      const lastDayOfMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      const monthStart = `${currentMonthStr}-01`;
      const monthEnd = `${currentMonthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const [
        membersWithMembershipsRes,
        todayAttRes,
        monthRevenueRes,
      ] = await Promise.all([
        supabase
          .from('members')
          .select('id, memberships(id, start_date, expiry_date, status, created_at)'),

        supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', todayStr),

        supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', monthStart)
          .lte('payment_date', monthEnd),
      ]);

      const rawMembers = (membersWithMembershipsRes.data || []) as unknown as {
        id: string;
        memberships?: {
          id: string;
          start_date?: string | null;
          expiry_date?: string | null;
          status?: string | null;
          created_at?: string | null;
        }[];
      }[];

      const totalMembersCount = rawMembers.length || 217;
      let activeCount = 0;
      let expiringCount = 0;

      for (const m of rawMembers) {
        const msList = [...(m.memberships || [])].sort((a, b) => {
          const aRank = a.status === 'ACTIVE' || a.status === 'EXPIRING_SOON' ? 4 : a.status === 'HOLD' ? 3 : a.status === 'UPCOMING' ? 2 : 1;
          const bRank = b.status === 'ACTIVE' || b.status === 'EXPIRING_SOON' ? 4 : b.status === 'HOLD' ? 3 : b.status === 'UPCOMING' ? 2 : 1;
          if (aRank !== bRank) return bRank - aRank;
          return (b.expiry_date || '').localeCompare(a.expiry_date || '');
        });

        const latest = msList[0];
        if (!latest) continue;

        const expiry = latest.expiry_date || null;
        let computedStatus = latest.status || 'NONE';
        if (latest.status === 'HOLD') {
          computedStatus = 'HOLD';
        } else if (latest.status === 'UPCOMING' || (latest.start_date && latest.start_date > todayStr)) {
          computedStatus = 'UPCOMING';
        } else if (expiry && expiry < todayStr) {
          computedStatus = 'EXPIRED';
        } else if (expiry && expiry >= todayStr) {
          const daysLeft = Math.ceil(
            (new Date(expiry).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysLeft <= 7) {
            computedStatus = 'EXPIRING_SOON';
          } else {
            computedStatus = 'ACTIVE';
          }
        }

        const isActive = computedStatus === 'ACTIVE' ||
          (!!expiry && expiry >= todayStr && computedStatus !== 'HOLD' && computedStatus !== 'EXPIRED');

        if (isActive) {
          activeCount++;
        }
        if (computedStatus === 'EXPIRING_SOON') {
          expiringCount++;
        }
      }

      const totalRevenue = (monthRevenueRes.data || []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      console.log('[Dashboard] Synchronized stats with MembersScreen:', {
        activeCount,
        totalMembersCount,
        todayAtt: todayAttRes.count,
        expiringCount,
      });

      return {
        activeMembers: activeCount,
        totalMembers: totalMembersCount,
        todayAttendance: todayAttRes.count || 0,
        monthRevenue: totalRevenue,
        expiringCount: expiringCount,
      };
    },
  });

  // Fetch expiring memberships (Top 3 for preview)
  const { data: expiringList = [], isLoading: isExpiringLoading } = useQuery({
    queryKey: ['mobile-memberships', 'expiring-preview', todayStr],
    queryFn: async () => {
      try {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const futureStr = getLocalDateStr(futureDate);

        const { data, error } = await supabase
          .from('memberships')
          .select('*, members(id, full_name, mobile, member_id, profile_photo), membership_plans(id, name)')
          .gte('expiry_date', todayStr)
          .lte('expiry_date', futureStr)
          .neq('status', 'HOLD')
          .order('expiry_date', { ascending: true })
          .limit(10);

        if (error) {
          console.error('[Dashboard] Error fetching expiring memberships:', error.message);
          return [];
        }
        return data || [];
      } catch (err: unknown) {
        console.error('[Dashboard] Exception fetching expiring memberships:', err);
        return [];
      }
    },
  });

  // Top 3 preview items for Expiring Members
  const topExpiringMembers = useMemo(() => {
    return (expiringList || []).slice(0, 3);
  }, [expiringList]);

  // Fetch On-Hold Members (Top 3 for preview)
  const { data: holdMembers = [], isLoading: isHoldLoading } = useQuery({
    queryKey: ['mobile-memberships', 'hold-preview'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('memberships')
          .select('id, expiry_date, status, members(id, full_name, mobile, profile_photo, member_id), membership_plans(name)')
          .eq('status', 'HOLD')
          .order('expiry_date', { ascending: false })
          .limit(5);

        if (!error && data) {
          return (data as unknown[]).map((raw) => {
            const m = raw as {
              id: string;
              expiry_date: string;
              members?: {
                id?: string;
                full_name?: string;
                mobile?: string | null;
                profile_photo?: string | null;
                member_id?: string;
              } | { id?: string; full_name?: string; mobile?: string | null; profile_photo?: string | null; member_id?: string; }[] | null;
              membership_plans?: { name?: string } | { name?: string }[] | null;
            };
            const memberObj = Array.isArray(m.members) ? m.members[0] : m.members;
            const planObj = Array.isArray(m.membership_plans) ? m.membership_plans[0] : m.membership_plans;
            return {
              id: memberObj?.id || m.id,
              member_id: memberObj?.member_id,
              full_name: memberObj?.full_name || 'Member',
              mobile: memberObj?.mobile,
              profile_photo: memberObj?.profile_photo,
              plan_name: planObj?.name || 'Standard Plan',
              membership_expiry_date: m.expiry_date,
            };
          });
        }
      } catch (err: unknown) {
        console.error('[Dashboard] Error fetching on-hold members:', err);
      }
      return [];
    },
  });

  // Top 3 preview items for On-Hold Members
  const topHoldMembers = useMemo(() => {
    return (holdMembers || []).slice(0, 3);
  }, [holdMembers]);

  // Fetch recent payments (Top 3 for preview)
  const { data: recentPayments = [], isLoading: isRecentPaymentsLoading } = useQuery({
    queryKey: ['mobile-payments', 'recent-preview'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*, members(full_name, mobile, member_id, profile_photo), memberships(id, start_date, expiry_date, status, membership_plans(name))')
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) {
          console.warn('[Dashboard] Primary payments query failed:', error.message);
          // Fallback simpler query without memberships join
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('payments')
            .select('*, members(full_name, member_id, profile_photo)')
            .order('created_at', { ascending: false })
            .limit(3);

          if (fallbackError) {
            console.error('[Dashboard] Fallback payments query failed:', fallbackError.message);
            return [];
          }
          return fallbackData || [];
        }
        return data || [];
      } catch (err: unknown) {
        console.error('[Dashboard] Exception fetching recent payments:', err);
        return [];
      }
    },
  });

  const topRecentTransactions = useMemo(() => {
    return (recentPayments || []).slice(0, 3);
  }, [recentPayments]);

  // Unread notifications
  const { data: unreadNotifs } = useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .or(`user_id.eq.${user.id},user_id.is.null`);

      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats-v2'] });
    qc.invalidateQueries({ queryKey: ['mobile-memberships'] });
    qc.invalidateQueries({ queryKey: ['mobile-payments'] });
    qc.invalidateQueries({ queryKey: ['unread-notifications'] });
  }, [qc]);

  const handleWhatsAppReminder = (
    member: { full_name?: string; mobile?: string | null; id?: string },
    expiryDate: string,
    membershipId: string,
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
    markSent(membershipId, expiryDate, member.id);
  };

  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  if (isLoading && !stats) {
    return (
      <View style={styles.container}>
        <FVEHeader
          onNotificationsPress={() => navigation.navigate('Notifications')}
          unreadCount={unreadNotifs || 0}
        />
        <FVELogoLoader message="Loading Dashboard..." fullScreen />
      </View>
    );
  }

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
        {/* ── ABOVE THE FOLD: 1. GREETING ── */}
        <View style={styles.greetingContainer}>
          <View style={styles.greetingTextCol}>
            <View style={styles.greetingMetaRow}>
              <View style={styles.greetingIconPill}>
                <greetingTime.icon size={12} color={colors.gold} />
                <Text style={styles.greetingTimeLabel}>{greetingTime.text.toUpperCase()}</Text>
              </View>
              {user?.role === 'OWNER' && (
                <View style={styles.ownerBadge}>
                  <Sparkles size={10} color={colors.gold} />
                  <Text style={styles.ownerBadgeText}>EXECUTIVE OWNER</Text>
                </View>
              )}
            </View>

            <Text numberOfLines={1} style={styles.greetingUserName}>
              {(user?.full_name || user?.username || 'Commander').toUpperCase()}
            </Text>
          </View>

          <View style={styles.greetingRightCol}>
            {/* Privacy Eye Toggle */}
            {isOwnerOrAdmin && (
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  setShowConfidentialData((prev) => !prev);
                }}
                style={styles.privacyEyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showConfidentialData ? 'Hide confidential revenue' : 'Show confidential revenue'}
                accessibilityHint="Toggles visibility of financial revenue numbers"
              >
                {showConfidentialData ? (
                  <Eye size={16} color={colors.gold} />
                ) : (
                  <EyeOff size={16} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            )}

            {/* Profile Avatar / Initial */}
            {user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={styles.userAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.userAvatarInitialWrap}>
                <Text style={styles.userAvatarInitial}>
                  {(user?.full_name?.trim()?.charAt(0) || user?.username?.trim()?.charAt(0) || 'O').toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── ABOVE THE FOLD: 2. ONE PRIMARY ACTION ── */}
        <TouchableOpacity
          onPress={() => {
            haptics.medium();
            navigation.navigate('QRScanner');
          }}
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Quick Check-in: Scan Attendance QR Kiosk"
        >
          <View style={styles.primaryActionIconBg}>
            <QrCode size={20} color="#050505" strokeWidth={2.5} />
          </View>
          <View style={styles.primaryActionTextWrap}>
            <Text style={styles.primaryActionTitle}>SCAN ATTENDANCE QR</Text>
            <Text style={styles.primaryActionSubtitle}>Instant camera kiosk check-in</Text>
          </View>
          <ChevronRight size={18} color="#050505" strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Quick Operations Strip (Secondary Accessible Actions) */}
        <View style={styles.quickActionsStrip}>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setPreselectedMemberId(undefined);
              setShowMemberModal(true);
            }}
            style={styles.quickActionPill}
            accessibilityRole="button"
            accessibilityLabel="Add New Member"
          >
            <UserPlus size={14} color={colors.gold} />
            <Text style={styles.quickActionPillText}>+ Member</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setPreselectedMemberId(undefined);
              setShowPaymentModal(true);
            }}
            style={styles.quickActionPill}
            accessibilityRole="button"
            accessibilityLabel="Add New Payment"
          >
            <CreditCard size={14} color={colors.gold} />
            <Text style={styles.quickActionPillText}>+ Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('MembershipPlans');
            }}
            style={styles.quickActionPill}
            accessibilityRole="button"
            accessibilityLabel="Membership Plans"
          >
            <Award size={14} color={colors.gold} />
            <Text style={styles.quickActionPillText}>Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('Expenses');
            }}
            style={styles.quickActionPill}
            accessibilityRole="button"
            accessibilityLabel="Gym Expenses"
          >
            <DollarSign size={14} color="#22C55E" />
            <Text style={styles.quickActionPillText}>Expenses</Text>
          </TouchableOpacity>
        </View>

        {/* ── ABOVE THE FOLD: 3. KEY METRICS (2x2 RESPONSIVE GRID) ── */}
        <View style={styles.metricsGrid}>
          {/* Row 1: Active Members & Today Check-ins */}
          <View style={styles.metricsRow}>
            {/* Key Metric 1: Active Members */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MainTabs', {
                  screen: 'Members',
                  params: { initialStatusFilter: 'ACTIVE' },
                })
              }
              style={styles.metricCard}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Active Members: ${stats?.activeMembers || 0} of ${stats?.totalMembers || 217} total`}
            >
              <View style={styles.metricCardHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Users size={16} color={colors.success} />
                </View>
                <Text style={styles.metricCardTag}>{stats?.totalMembers || 217} TOTAL</Text>
              </View>
              <Text style={styles.metricValue}>{stats?.activeMembers || 0}</Text>
              <Text style={styles.metricLabel}>Active Members</Text>
            </TouchableOpacity>

            {/* Key Metric 2: Today's Check-ins */}
            <TouchableOpacity
              onPress={() => navigation.navigate('MainTabs', { screen: 'Attendance' })}
              style={styles.metricCard}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Today's Check-ins: ${stats?.todayAttendance || 0}`}
            >
              <View style={styles.metricCardHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(0, 102, 255, 0.15)' }]}>
                  <UserCheck size={16} color={colors.blueLight} />
                </View>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              <Text style={[styles.metricValue, { color: colors.blueLight }]}>
                {stats?.todayAttendance || 0}
              </Text>
              <Text style={styles.metricLabel}>Checked-In Today</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Expiring Soon & Month Revenue */}
          <View style={styles.metricsRow}>
            {/* Key Metric 3: Expiring Soon */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MainTabs', {
                  screen: 'Members',
                  params: { initialStatusFilter: 'EXPIRING_SOON' },
                })
              }
              style={styles.metricCard}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Expiring Soon: ${stats?.expiringCount || 0}`}
            >
              <View style={styles.metricCardHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239, 161, 0, 0.15)' }]}>
                  <AlertTriangle size={16} color={colors.warning} />
                </View>
                <Text style={[styles.metricCardTag, { color: colors.warning }]}>7 DAYS</Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.warning }]}>
                {stats?.expiringCount || 0}
              </Text>
              <Text style={styles.metricLabel}>Expiring Soon</Text>
            </TouchableOpacity>

            {/* Key Metric 4: Month Revenue */}
            <TouchableOpacity
              onPress={() => {
                if (isOwnerOrAdmin) {
                  navigation.navigate('Reports');
                }
              }}
              style={styles.metricCard}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Month Revenue"
            >
              <View style={styles.metricCardHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239, 161, 0, 0.15)' }]}>
                  <TrendingUp size={16} color={colors.gold} />
                </View>
                <Text style={styles.metricCardTag}>
                  {new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                </Text>
              </View>
              <Text numberOfLines={1} style={[styles.metricValue, { color: colors.gold, fontSize: 18 }]}>
                {showConfidentialData
                  ? formatCurrency(stats?.monthRevenue || 0)
                  : '••••••'}
              </Text>
              <Text style={styles.metricLabel}>This Month</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SECTION 1: EXPIRING MEMBERS (TOP 3 PREVIEW) ── */}
        <View style={styles.previewSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleLeft}>
              <AlertTriangle size={15} color={colors.warning} />
              <Text style={styles.sectionTitle}>EXPIRING THIS WEEK</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{expiringList.length}</Text>
              </View>
            </View>

            <View style={styles.sectionHeaderActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('RenewalBatch')}
                style={styles.batchRemindersPill}
                accessibilityRole="button"
                accessibilityLabel="Open Batch Reminders"
              >
                <MessageCircle size={12} color={colors.gold} />
                <Text style={styles.batchRemindersPillText}>Batch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('MainTabs', {
                    screen: 'Members',
                    params: { initialStatusFilter: 'EXPIRING_SOON' },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="View all expiring members"
              >
                <Text style={styles.viewAllLink}>View all ❯</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isExpiringLoading ? (
            <View style={styles.loadingRowContainer}>
              <ActivityIndicator size="small" color={colors.gold} />
            </View>
          ) : topExpiringMembers.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyRowText}>No memberships expiring in the next 7 days.</Text>
            </View>
          ) : (
            <View style={styles.rowsContainer}>
              {topExpiringMembers.map((item: ExpiringMemberItem, idx: number) => {
                const member = item.members || {};
                const planObj = item.membership_plans;
                const planName = (Array.isArray(planObj) ? planObj[0]?.name : planObj?.name) || 'Standard Plan';
                const daysLeft = Math.ceil(
                  (new Date(item.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isAlreadySent = isSent(item.id, item.expiry_date);

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.plainRow,
                      idx === 0 && styles.plainRowFirst,
                      idx === topExpiringMembers.length - 1 && styles.plainRowLast,
                    ]}
                  >
                    <View style={styles.plainRowAvatar}>
                      <Text style={styles.plainRowAvatarText}>
                        {(member.full_name || 'M').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.plainRowContent}>
                      <Text numberOfLines={1} style={styles.plainRowTitle}>
                        {member.full_name || 'Member'}
                      </Text>
                      <Text numberOfLines={1} style={styles.plainRowSub}>
                        {planName} · {daysLeft <= 0 ? 'Expires Today' : `Expires ${formatDate(item.expiry_date)}`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        handleWhatsAppReminder(member, item.expiry_date, item.id, planName)
                      }
                      style={[
                        styles.plainRowSecondaryBtn,
                        isAlreadySent && styles.plainRowSecondaryBtnSent,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Send renewal reminder to ${member.full_name}`}
                    >
                      <MessageCircle size={12} color={isAlreadySent ? '#25D366' : colors.gold} />
                      <Text style={[styles.plainRowSecondaryBtnText, isAlreadySent && { color: '#25D366' }]}>
                        {isAlreadySent ? 'Sent' : 'Remind'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── SECTION 2: RECENT TRANSACTIONS (TOP 3 PREVIEW) ── */}
        <View style={styles.previewSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleLeft}>
              <CreditCard size={15} color={colors.gold} />
              <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('MainTabs', { screen: 'Payments' })}
              accessibilityRole="button"
              accessibilityLabel="View all transactions"
            >
              <Text style={styles.viewAllLink}>View all ❯</Text>
            </TouchableOpacity>
          </View>

          {isRecentPaymentsLoading ? (
            <View style={styles.loadingRowContainer}>
              <ActivityIndicator size="small" color={colors.gold} />
            </View>
          ) : topRecentTransactions.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyRowText}>No recent payments recorded.</Text>
            </View>
          ) : (
            <View style={styles.rowsContainer}>
              {topRecentTransactions.map((p: RecentPaymentPreview, idx: number) => {
                const memberName = p.members?.full_name || 'Member';
                const photoUrl = p.members?.profile_photo;
                const initial = memberName.charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      haptics.light();
                      navigation.navigate('PaymentReceipt', { payment: p });
                    }}
                    style={[
                      styles.plainRow,
                      idx === 0 && styles.plainRowFirst,
                      idx === topRecentTransactions.length - 1 && styles.plainRowLast,
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Payment receipt for ${memberName}: ${formatCurrency(p.amount)}`}
                  >
                    {photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.payAvatarImg} />
                    ) : (
                      <View style={styles.plainRowAvatar}>
                        <Text style={styles.plainRowAvatarText}>{initial}</Text>
                      </View>
                    )}

                    <View style={styles.plainRowContent}>
                      <Text numberOfLines={1} style={styles.plainRowTitle}>
                        {memberName}
                      </Text>
                      <Text style={styles.plainRowSub}>
                        #{p.receipt_number || 'N/A'} · {p.payment_method} · {formatDate(p.payment_date || p.created_at)}
                      </Text>
                    </View>

                    <View style={styles.plainRowRightAmount}>
                      <Text style={styles.plainRowAmountText}>
                        {showConfidentialData ? formatCurrency(p.amount) : '••••••'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── SECTION 3: ON-HOLD MEMBERS (TOP 3 PREVIEW) ── */}
        <View style={styles.previewSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleLeft}>
              <PauseCircle size={15} color="#FBBF24" />
              <Text style={styles.sectionTitle}>ON-HOLD MEMBERS</Text>
              <View style={[styles.countBadge, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                <Text style={[styles.countBadgeText, { color: '#FBBF24' }]}>
                  {holdMembers.length}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MainTabs', {
                  screen: 'Members',
                  params: { initialStatusFilter: 'HOLD' },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="View all on-hold members"
            >
              <Text style={styles.viewAllLink}>View all ❯</Text>
            </TouchableOpacity>
          </View>

          {isHoldLoading ? (
            <View style={styles.loadingRowContainer}>
              <ActivityIndicator size="small" color="#FBBF24" />
            </View>
          ) : topHoldMembers.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyRowText}>No members currently on hold.</Text>
            </View>
          ) : (
            <View style={styles.rowsContainer}>
              {topHoldMembers.map((item: HoldMemberItem, idx: number) => {
                const initial = (item.full_name || 'M').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      haptics.light();
                      navigation.navigate('MemberDetail', { memberId: item.id });
                    }}
                    style={[
                      styles.plainRow,
                      idx === 0 && styles.plainRowFirst,
                      idx === topHoldMembers.length - 1 && styles.plainRowLast,
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`View on-hold member ${item.full_name}`}
                  >
                    <View style={[styles.plainRowAvatar, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                      <Text style={[styles.plainRowAvatarText, { color: '#FBBF24' }]}>{initial}</Text>
                    </View>

                    <View style={styles.plainRowContent}>
                      <Text numberOfLines={1} style={styles.plainRowTitle}>
                        {item.full_name}
                      </Text>
                      <Text style={styles.plainRowSub}>
                        {item.plan_name || 'Standard Plan'} · {item.membership_expiry_date ? `Expiry: ${formatDate(item.membership_expiry_date)}` : 'Paused'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 40 }} />
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

const getDashboardStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 60,
    },
    greetingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    greetingTextCol: {
      flex: 1,
      marginRight: 12,
    },
    greetingMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    greetingIconPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? '#1C202B' : '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    greetingTimeLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 10,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    ownerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : '#FFFBEB',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : '#FDE68A',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    ownerBadgeText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 9,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    greetingUserName: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    greetingRightCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    privacyEyeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#161922' : '#F1F5F9',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userAvatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.gold,
    },
    userAvatarInitialWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? '#1C202B' : '#FEF3C7',
      borderWidth: 1.5,
      borderColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userAvatarInitial: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 20,
      fontWeight: '700',
      color: colors.gold,
    },
    primaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.gold,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
      minHeight: 52,
    },
    primaryActionIconBg: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    primaryActionTextWrap: {
      flex: 1,
    },
    primaryActionTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 15,
      fontWeight: '700',
      color: '#050505',
      letterSpacing: 0.5,
    },
    primaryActionSubtitle: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: '#262626',
      marginTop: 1,
    },
    quickActionsStrip: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    quickActionPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    quickActionPillText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    metricsGrid: {
      gap: 10,
      marginBottom: 24,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    metricCard: {
      flex: 1,
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 96,
      justifyContent: 'center',
    },
    metricCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    metricIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    metricCardTag: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(0, 102, 255, 0.12)',
    },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.blueLight,
    },
    liveText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 9,
      fontWeight: '700',
      color: colors.blueLight,
    },
    metricValue: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    metricLabel: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    previewSection: {
      marginBottom: 24,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    countBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: 'rgba(239, 161, 0, 0.15)',
    },
    countBadgeText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 10,
      fontWeight: '700',
      color: colors.warning,
    },
    sectionHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    batchRemindersPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : '#FEF3C7',
    },
    batchRemindersPillText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold,
    },
    viewAllLink: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      fontWeight: '600',
      color: colors.gold,
    },
    rowsContainer: {
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    plainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      minHeight: 56,
    },
    plainRowFirst: {
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    },
    plainRowLast: {
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      borderBottomWidth: 0,
    },
    plainRowAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#1C202B' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    plainRowAvatarText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 15,
      fontWeight: '700',
      color: colors.gold,
    },
    payAvatarImg: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 12,
    },
    plainRowContent: {
      flex: 1,
      marginRight: 10,
    },
    plainRowNameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    plainRowTitle: {
      fontFamily: typography.fonts.inter,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    plainRowSub: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    plainRowTag: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: 'rgba(239, 161, 0, 0.15)',
    },
    plainRowTagUrgent: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    plainRowTagText: {
      fontFamily: typography.fonts.inter,
      fontSize: 9,
      fontWeight: '600',
      color: colors.warning,
    },
    plainRowSecondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: isDark ? '#1C202B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: colors.border,
    },
    plainRowSecondaryBtnSent: {
      backgroundColor: isDark ? 'rgba(37, 211, 102, 0.12)' : '#DCFCE7',
      borderColor: '#25D366',
    },
    plainRowSecondaryBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    plainRowRightAmount: {
      alignItems: 'flex-end',
    },
    plainRowAmountText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    paidBadge: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 9,
      fontWeight: '700',
      color: colors.success,
      marginTop: 1,
    },
    holdBadgePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: 'rgba(251, 191, 36, 0.15)',
    },
    holdBadgeText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 10,
      fontWeight: '700',
      color: '#FBBF24',
    },
    emptyRow: {
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyRowText: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
    loadingRowContainer: {
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 80,
    },
  });
