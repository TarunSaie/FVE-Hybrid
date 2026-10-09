import React, { useState, useMemo } from 'react';
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
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  MessageCircle,
  Share2,
  Users,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { WhatsAppQueueModal, ExpiringQueueItem } from '@/components/features/WhatsAppQueueModal';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useBranding } from '@/contexts/BrandingContext';
import { openWhatsAppLink, buildExpiryReminderMessage } from '@/utils/format';
import { getLocalDateStr, formatDate } from '@/utils/date';
import { useRenewalMessagingStatus } from '@/utils/renewalMessaging';
import { RenewalBatchSize } from '@/types';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

interface ExpiringMembershipRecord {
  id: string;
  member_id: string;
  plan_id?: string | null;
  plan_name?: string | null;
  expiry_date: string;
  status: string;
  members?: {
    id: string;
    full_name: string;
    mobile: string | null;
    member_id: string;
    profile_photo?: string | null;
  } | null;
  membership_plans?: {
    id: string;
    name: string;
  } | { id: string; name: string }[] | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function RenewalBatchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const { brandConfig } = useBranding();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const qc = useQueryClient();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWhatsAppQueueModal, setShowWhatsAppQueueModal] = useState(false);
  const [whatsAppQueue, setWhatsAppQueue] = useState<ExpiringQueueItem[]>([]);
  const [preselectedMemberId, setPreselectedMemberId] = useState<string | undefined>(undefined);

  const { isSent, markSent, clearAll: clearRenewalSentRecords, version: renewalMapVersion } = useRenewalMessagingStatus();
  const [renewalBatchSize, setRenewalBatchSize] = useState<RenewalBatchSize>(30);
  const [expiringFilterTab, setExpiringFilterTab] = useState<'pending' | 'sent' | 'all'>('pending');

  const todayStr = getLocalDateStr();

  // Fetch expiring memberships (all eligible up to 500)
  const { data: expiringList = [], isLoading, refetch } = useQuery<ExpiringMembershipRecord[]>({
    queryKey: ['mobile-expiring-memberships', todayStr],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureStr = getLocalDateStr(futureDate);

      const { data } = await supabase
        .from('memberships')
        .select('*, members(id, full_name, mobile, member_id, profile_photo), membership_plans(id, name)')
        .gte('expiry_date', todayStr)
        .lte('expiry_date', futureStr)
        .neq('status', 'HOLD')
        .order('expiry_date', { ascending: true })
        .limit(500);

      return (data || []) as ExpiringMembershipRecord[];
    },
  });

  const { data: plansLookup } = useQuery({
    queryKey: ['mobile-membership-plans-lookup-map'],
    queryFn: async () => {
      const { data } = await supabase.from('membership_plans').select('id, name');
      const map: Record<string, string> = {};
      (data || []).forEach((p: { id: string; name: string }) => {
        if (p.id && p.name) map[p.id] = p.name;
      });
      return map;
    },
    staleTime: 1000 * 60 * 30,
  });

  const getMemberPlanName = (m: ExpiringMembershipRecord): string => {
    if (m?.plan_name && typeof m.plan_name === 'string' && m.plan_name.trim()) {
      return m.plan_name.trim();
    }
    const rel = m?.membership_plans;
    if (rel) {
      if (Array.isArray(rel) && rel.length > 0 && rel[0]?.name) {
        return rel[0].name.trim();
      }
      if (typeof rel === 'object' && 'name' in rel && rel.name) {
        return rel.name.trim();
      }
    }
    if (m?.plan_id && plansLookup && plansLookup[m.plan_id]) {
      return plansLookup[m.plan_id].trim();
    }
    return 'Gym Membership';
  };

  const pendingExpiringList = useMemo(() => {
    if (!expiringList) return [];
    return expiringList.filter((m: ExpiringMembershipRecord) => !isSent(m.id, m.expiry_date));
  }, [expiringList, isSent, renewalMapVersion]);

  const sentExpiringList = useMemo(() => {
    if (!expiringList) return [];
    return expiringList.filter((m: ExpiringMembershipRecord) => isSent(m.id, m.expiry_date));
  }, [expiringList, isSent, renewalMapVersion]);

  const displayedExpiringList = useMemo(() => {
    if (expiringFilterTab === 'pending') {
      return pendingExpiringList;
    }
    if (expiringFilterTab === 'sent') {
      return sentExpiringList;
    }
    return [...pendingExpiringList, ...sentExpiringList];
  }, [expiringFilterTab, pendingExpiringList, sentExpiringList]);

  const onRefresh = () => {
    haptics.light();
    refetch();
    qc.invalidateQueries({ queryKey: ['mobile-expiring-memberships'] });
  };

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

  const handleNotifyBatch = (customSize?: RenewalBatchSize) => {
    const sizeToUse = customSize || renewalBatchSize;
    if (!pendingExpiringList?.length) {
      Alert.alert('All Messaged', 'All eligible expiring members have already been messaged!');
      return;
    }
    const withMobile = pendingExpiringList.filter((m: ExpiringMembershipRecord) => {
      const mob = m.members?.mobile;
      return Boolean(mob?.trim());
    });

    if (withMobile.length === 0) {
      Alert.alert('No Mobile Numbers', 'No pending expiring members have a valid mobile phone number recorded.');
      return;
    }

    const batchCount = sizeToUse === 'all' ? withMobile.length : Math.min(Number(sizeToUse) || 30, withMobile.length);
    const targetBatch = withMobile.slice(0, batchCount);

    const gymName = brandConfig.gym_name || 'FitVerse Elite';
    const queueItems: ExpiringQueueItem[] = targetBatch.map((m: ExpiringMembershipRecord) => {
      const member = m.members;
      const memberName = member?.full_name || 'Member';
      const planName = getMemberPlanName(m);
      const daysLeft = Math.ceil(
        (new Date(m.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const msg = buildExpiryReminderMessage(
        memberName,
        planName,
        m.expiry_date,
        daysLeft,
        gymName
      );

      return {
        id: m.id,
        memberId: m.member_id,
        memberName,
        memberMobile: member?.mobile || '',
        planName,
        expiryDate: m.expiry_date,
        daysLeft,
        message: msg,
      };
    });

    setWhatsAppQueue(queueItems);
    setShowWhatsAppQueueModal(true);
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="RENEWAL REMINDERS"
        subtitle="Batch WhatsApp Notifications"
        showBack
        onBack={() => navigation.goBack()}
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
        {/* Metric Cards Summary */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>PENDING</Text>
            <Text style={[styles.metricValue, { color: colors.warning }]}>
              {pendingExpiringList.length}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>MESSAGED</Text>
            <Text style={[styles.metricValue, { color: '#25D366' }]}>
              {sentExpiringList.length}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>TOTAL EXPIRING</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {expiringList.length}
            </Text>
          </View>
        </View>

        {/* Batch Selector & Trigger */}
        <View style={styles.batchSection}>
          <View style={styles.batchHeaderRow}>
            <Text style={styles.batchSectionTitle}>BATCH SIZE</Text>
            {sentExpiringList.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Reset Messaged Status',
                    'Reset messaged status for all expiring members? This will move them back to Pending.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: () => {
                          clearRenewalSentRecords();
                          haptics.success();
                        },
                      },
                    ]
                  );
                }}
                style={styles.resetBtn}
                accessibilityRole="button"
                accessibilityLabel="Reset messaged status"
              >
                <RotateCcw size={12} color={colors.textSecondary} />
                <Text style={styles.resetBtnText}>Reset Sent</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.batchPillsRow}>
            {([10, 30, 50, 'all'] as const).map((size) => (
              <TouchableOpacity
                key={String(size)}
                onPress={() => {
                  haptics.selection();
                  setRenewalBatchSize(size);
                }}
                style={[
                  styles.batchPill,
                  renewalBatchSize === size && styles.batchPillActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select batch size ${size}`}
              >
                <Text
                  style={[
                    styles.batchPillText,
                    renewalBatchSize === size && styles.batchPillTextActive,
                  ]}
                >
                  {size === 'all' ? 'All' : `${size} Members`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => handleNotifyBatch()}
            disabled={pendingExpiringList.length === 0}
            style={[
              styles.primaryNotifyBtn,
              pendingExpiringList.length === 0 && styles.btnDisabled,
            ]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Notify batch of members via WhatsApp"
          >
            <MessageCircle size={18} color="#050505" strokeWidth={2.5} />
            <Text style={styles.primaryNotifyBtnText}>
              {pendingExpiringList.length === 0
                ? 'All Members Messaged'
                : `Launch WhatsApp Batch (${Math.min(
                    renewalBatchSize === 'all'
                      ? pendingExpiringList.length
                      : Number(renewalBatchSize),
                    pendingExpiringList.length
                  )})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs */}
        <View style={styles.filterTabsRow}>
          {(['pending', 'sent', 'all'] as const).map((tab) => {
            const count =
              tab === 'pending'
                ? pendingExpiringList.length
                : tab === 'sent'
                ? sentExpiringList.length
                : expiringList.length;
            const label = tab === 'pending' ? 'Pending' : tab === 'sent' ? 'Messaged' : 'All';
            const isActive = expiringFilterTab === tab;

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  haptics.selection();
                  setExpiringFilterTab(tab);
                }}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Member Rows */}
        {displayedExpiringList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CheckCircle2 size={32} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>
              {expiringFilterTab === 'pending'
                ? 'All eligible members have been messaged.'
                : 'No members in this category.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {displayedExpiringList.map((item: ExpiringMembershipRecord) => {
              const member = item.members;
              const memberName = member?.full_name || 'Member';
              const planName = getMemberPlanName(item);
              const daysLeft = Math.ceil(
                (new Date(item.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              const alreadySent = isSent(item.id, item.expiry_date);

              return (
                <View key={item.id} style={styles.memberRow}>
                  <View style={styles.avatarPill}>
                    <Text style={styles.avatarInitial}>
                      {memberName.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text numberOfLines={1} style={styles.memberName}>
                        {memberName}
                      </Text>
                      <View
                        style={[
                          styles.daysLeftPill,
                          daysLeft <= 1 && styles.daysLeftPillUrgent,
                        ]}
                      >
                        <Text style={styles.daysLeftText}>
                          {daysLeft <= 0 ? 'Today' : `${daysLeft}d left`}
                        </Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.memberMeta}>
                      {planName} · Expires {formatDate(item.expiry_date)}
                    </Text>
                  </View>

                  <View style={styles.actionsGroup}>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        if (member?.id) {
                          setPreselectedMemberId(member.id);
                          setShowPaymentModal(true);
                        }
                      }}
                      style={styles.renewBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Renew ${memberName}`}
                    >
                      <Text style={styles.renewBtnText}>Renew</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleWhatsAppReminder(member || {}, item.expiry_date, item.id, planName)
                      }
                      style={[
                        styles.waBtn,
                        alreadySent && styles.waBtnSent,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Send WhatsApp reminder to ${memberName}`}
                    >
                      {alreadySent ? (
                        <CheckCircle2 size={15} color="#25D366" />
                      ) : (
                        <Share2 size={15} color="#050505" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Payment Form Modal for quick renew */}
      <PaymentFormModal
        visible={showPaymentModal}
        preselectedMemberId={preselectedMemberId}
        onClose={() => {
          setShowPaymentModal(false);
          setPreselectedMemberId(undefined);
        }}
        onSaved={onRefresh}
      />

      {/* WhatsApp Fast-Queue Modal */}
      <WhatsAppQueueModal
        visible={showWhatsAppQueueModal}
        onClose={() => setShowWhatsAppQueueModal(false)}
        queue={whatsAppQueue}
        onMemberSent={(item) => {
          markSent(item.id, item.expiryDate, item.memberId);
        }}
        batchInfo={{
          batchSize: renewalBatchSize,
          totalPending: pendingExpiringList.length,
          remainingAfterBatch: Math.max(0, pendingExpiringList.length - whatsAppQueue.length),
        }}
        onProceedNextBatch={() => {
          setShowWhatsAppQueueModal(false);
          setTimeout(() => {
            handleNotifyBatch();
          }, 200);
        }}
      />
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
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    metricCard: {
      flex: 1,
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    metricValue: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 22,
      fontWeight: '700',
    },
    batchSection: {
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    batchHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    batchSectionTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: isDark ? '#1C202B' : '#F1F5F9',
    },
    resetBtnText: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    batchPillsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    batchPill: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#161922' : '#F8FAFC',
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    batchPillActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : '#FEF3C7',
      borderColor: colors.gold,
    },
    batchPillText: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    batchPillTextActive: {
      color: colors.gold,
      fontWeight: '700',
    },
    primaryNotifyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.gold,
      borderRadius: 10,
      paddingVertical: 12,
      minHeight: 48,
    },
    btnDisabled: {
      opacity: 0.4,
    },
    primaryNotifyBtnText: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 15,
      fontWeight: '700',
      color: '#050505',
      letterSpacing: 0.5,
    },
    filterTabsRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#11141A' : '#F1F5F9',
      borderRadius: 10,
      padding: 3,
      marginBottom: 14,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      minHeight: 44,
    },
    filterTabActive: {
      backgroundColor: isDark ? '#1C202B' : '#FFFFFF',
    },
    filterTabText: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    filterTabTextActive: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    listContainer: {
      borderRadius: 12,
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      minHeight: 60,
    },
    avatarPill: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? '#1C202B' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarInitial: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 16,
      fontWeight: '700',
      color: colors.gold,
    },
    memberInfo: {
      flex: 1,
      marginRight: 10,
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    memberName: {
      fontFamily: typography.fonts.inter,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    daysLeftPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(239, 161, 0, 0.15)',
    },
    daysLeftPillUrgent: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    daysLeftText: {
      fontFamily: typography.fonts.inter,
      fontSize: 10,
      fontWeight: '600',
      color: colors.warning,
    },
    memberMeta: {
      fontFamily: typography.fonts.inter,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    actionsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    renewBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.gold,
      minHeight: 44,
      justifyContent: 'center',
    },
    renewBtnText: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      fontWeight: '600',
      color: colors.gold,
    },
    waBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waBtnSent: {
      backgroundColor: isDark ? '#143823' : '#DCFCE7',
      borderWidth: 1,
      borderColor: '#25D366',
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontFamily: typography.fonts.inter,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
