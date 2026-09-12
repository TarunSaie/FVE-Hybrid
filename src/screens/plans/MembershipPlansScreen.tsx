import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Award,
  Edit,
  Trash2,
  Check,
  Clock,
  Dumbbell,
  Calendar,
  Sparkles,
  ArrowRight,
  Search,
  FileText,
  MessageCircle,
  TrendingUp,
  CreditCard,
  Ban,
  CheckCircle2,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { PlanFormModal } from '@/components/features/PlanFormModal';
import { PTPlanFormModal } from '@/components/features/PTPlanFormModal';
import { PlanChangeModal } from '@/components/features/PlanChangeModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import {
  MembershipPlan,
  PersonalTrainingPlan,
  PlanChangeRequest,
  PlanChangeStatus,
  Payment,
} from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import {
  formatCurrency,
  parseFeatures,
  buildPlanUpgradeWhatsAppMessage,
  openWhatsAppLink,
} from '@/utils/format';
import { formatDate } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function MembershipPlansScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(user?.role || '');

  // Tab State
  const [activeTab, setActiveTab] = useState<'membership' | 'pt' | 'upgrades'>('membership');
  const [upgradeStatusFilter, setUpgradeStatusFilter] = useState<'ALL' | PlanChangeStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequestForModal, setSelectedRequestForModal] = useState<PlanChangeRequest | null>(null);

  // Membership modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  // PT modal state
  const [showPTModal, setShowPTModal] = useState(false);
  const [selectedPTPlan, setSelectedPTPlan] = useState<PersonalTrainingPlan | null>(null);

  // Fetch Membership Plans
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['mobile-membership-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .order('price', { ascending: true });
      if (error) throw error;
      return (data || []) as MembershipPlan[];
    },
  });

  // Fetch Personal Training Plans
  const { data: ptPlans, isLoading: ptPlansLoading, refetch: refetchPTPlans } = useQuery({
    queryKey: ['mobile-pt-plans'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('personal_training_plans')
          .select('*')
          .order('total_sessions', { ascending: true });
        if (error) {
          console.warn('Mobile PT plans query note:', error.message);
          return [];
        }
        return (data || []) as PersonalTrainingPlan[];
      } catch (err) {
        console.warn('Mobile PT plans query error:', err);
        return [];
      }
    },
  });

  // Fetch Plan Change Requests
  const {
    data: requests = [],
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useQuery<PlanChangeRequest[]>({
    queryKey: ['plan-change-requests'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('plan_change_requests')
          .select(
            '*, members(*), memberships(*, membership_plans(*)), current_plan:membership_plans!current_plan_id(*), requested_plan:membership_plans!requested_plan_id(*), approver:user_profiles!approved_by(*)'
          )
          .order('created_at', { ascending: false });
        if (error) {
          console.warn('Plan change requests error:', error.message);
          return [];
        }
        return (data as unknown as PlanChangeRequest[]) || [];
      } catch (err) {
        console.warn('Plan change requests error:', err);
        return [];
      }
    },
  });

  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING').length;

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesStatus = upgradeStatusFilter === 'ALL' || req.status === upgradeStatusFilter;
      const q = searchQuery.toLowerCase().trim();
      const memberName = req.members?.full_name?.toLowerCase() || '';
      const memberId = req.members?.member_id?.toLowerCase() || '';
      const memberMobile = req.members?.mobile || '';
      const matchesSearch =
        !q ||
        memberName.includes(q) ||
        memberId.includes(q) ||
        memberMobile.includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [requests, upgradeStatusFilter, searchQuery]);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mobile-membership-plans'] });
    qc.invalidateQueries({ queryKey: ['mobile-pt-plans'] });
    qc.invalidateQueries({ queryKey: ['plan-change-requests'] });
  }, [qc]);

  // Membership Plan Actions
  const togglePlanActive = async (plan: MembershipPlan) => {
    try {
      const { error } = await supabase
        .from('membership_plans')
        .update({ active: !plan.active })
        .eq('id', plan.id);
      if (error) throw error;
      onRefresh();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to update plan');
    }
  };

  const handleDeletePlan = (plan: MembershipPlan) => {
    Alert.alert(
      'Delete Plan',
      `Delete "${plan.name}" plan? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('membership_plans')
                .delete()
                .eq('id', plan.id);
              if (error) throw error;
              onRefresh();
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error).message || 'Failed to delete plan');
            }
          },
        },
      ]
    );
  };

  // PT Plan Actions
  const togglePTPlanActive = async (ptPlan: PersonalTrainingPlan) => {
    try {
      const { error } = await supabase
        .from('personal_training_plans')
        .update({ active: !ptPlan.active })
        .eq('id', ptPlan.id);
      if (error) throw error;
      onRefresh();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to update PT plan');
    }
  };

  const handleDeletePTPlan = (ptPlan: PersonalTrainingPlan) => {
    Alert.alert(
      'Delete PT Package',
      `Delete "${ptPlan.name}" package? Existing active member sessions will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('personal_training_plans')
                .delete()
                .eq('id', ptPlan.id);
              if (error) throw error;
              onRefresh();
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error).message || 'Failed to delete PT plan');
            }
          },
        },
      ]
    );
  };

  const isLoading =
    activeTab === 'membership'
      ? plansLoading
      : activeTab === 'pt'
      ? ptPlansLoading
      : requestsLoading;

  return (
    <View style={styles.container}>
      <FVEHeader
        title="GYM & PT PLANS"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          activeTab !== 'upgrades' ? (
            <TouchableOpacity
              onPress={() => {
                if (activeTab === 'membership') {
                  setSelectedPlan(null);
                  setShowPlanModal(true);
                } else {
                  setSelectedPTPlan(null);
                  setShowPTModal(true);
                }
              }}
              style={styles.addBtn}
            >
              <Plus size={16} color={colors.gold} />
              <Text style={styles.addBtnText}>
                {activeTab === 'membership' ? 'New Plan' : 'New PT'}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Segmented Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('membership');
          }}
          style={[styles.tabButton, activeTab === 'membership' && styles.tabButtonActive]}
        >
          <Award size={13} color={activeTab === 'membership' ? colors.background : colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'membership' && styles.tabButtonTextActive]}>
            PLANS ({plans?.filter((p) => p.active).length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('pt');
          }}
          style={[styles.tabButton, activeTab === 'pt' && styles.tabButtonActive]}
        >
          <Dumbbell size={13} color={activeTab === 'pt' ? colors.background : colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'pt' && styles.tabButtonTextActive]}>
            PT ({ptPlans?.filter((p) => p.active).length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('upgrades');
          }}
          style={[styles.tabButton, activeTab === 'upgrades' && styles.tabButtonActive]}
        >
          <Sparkles size={13} color={activeTab === 'upgrades' ? colors.background : colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'upgrades' && styles.tabButtonTextActive]}>
            UPGRADES{pendingRequestsCount > 0 ? ` (${pendingRequestsCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <FVELogoLoader
          message={
            activeTab === 'membership'
              ? 'Syncing Plans...'
              : activeTab === 'pt'
              ? 'Syncing PT Packages...'
              : 'Syncing Upgrade Requests...'
          }
          fullScreen
        />
      ) : activeTab === 'membership' ? (
        /* MEMBERSHIP PLANS LIST */
        <FlatList
          data={plans || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={plansLoading} onRefresh={onRefresh} tintColor={colors.gold} />
          }
          renderItem={({ item }) => {
            const features = parseFeatures(item.features);
            return (
              <View style={[styles.planCard, !item.active && styles.inactiveCard]}>
                <View style={styles.planHeader}>
                  <View style={styles.planTitleContainer}>
                    <Text style={styles.planName}>{item.name}</Text>
                    <View style={styles.durationRow}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={styles.durationText}>
                        {item.duration_days} Days Access · {item.duration_type}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.planPrice}>{formatCurrency(item.price)}</Text>
                </View>

                {item.visit_day_limit != null && (
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitText}>
                      {item.visit_day_limit} Visit Days Limit
                    </Text>
                  </View>
                )}

                {features.length > 0 && (
                  <View style={styles.featuresContainer}>
                    {features.map((feat, idx) => (
                      <View key={idx} style={styles.featureItemRow}>
                        <Check size={12} color={colors.gold} style={styles.featureCheckIcon} />
                        <Text style={styles.featureItemText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      togglePlanActive(item);
                    }}
                    style={[
                      styles.statusToggleBtn,
                      item.active ? styles.activeBtn : styles.inactiveBtn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        { color: item.active ? colors.success : colors.textMuted },
                      ]}
                    >
                      {item.active ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.rightActions}>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        setSelectedPlan(item);
                        setShowPlanModal(true);
                      }}
                      style={styles.iconActionBtn}
                    >
                      <Edit size={16} color={colors.gold} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        haptics.warning();
                        handleDeletePlan(item);
                      }}
                      style={[styles.iconActionBtn, styles.deleteBtn]}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <FVEEmptyState
              icon={<Award size={40} color={colors.gold} />}
              title="No Membership Plans"
              description="Create recurring or limited plans for your members."
              actionTitle="+ Create Plan"
              onAction={() => {
                setSelectedPlan(null);
                setShowPlanModal(true);
              }}
            />
          }
        />
      ) : activeTab === 'pt' ? (
        /* PERSONAL TRAINING PACKAGES LIST */
        <FlatList
          data={ptPlans || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={ptPlansLoading} onRefresh={onRefresh} tintColor={colors.gold} />
          }
          renderItem={({ item }) => {
            const features = parseFeatures(item.features);
            const numPrice = Number(item.price || 0);
            const perSession = item.total_sessions > 0 ? Math.round(numPrice / item.total_sessions) : 0;

            return (
              <View style={[styles.planCard, styles.ptCardBorder, !item.active && styles.inactiveCard]}>
                <View style={styles.planHeader}>
                  <View style={styles.planTitleContainer}>
                    <Text style={styles.planName}>{item.name}</Text>
                    <View style={styles.durationRow}>
                      <Clock size={12} color={colors.gold} />
                      <Text style={[styles.durationText, { color: colors.gold, fontWeight: '700' }]}>
                        {item.total_sessions} Sessions · {item.duration_days} Days Validity
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planPrice}>{formatCurrency(item.price)}</Text>
                    {item.total_sessions > 0 && (
                      <Text style={styles.ptPerSessionSubtitle}>({formatCurrency(perSession)}/session)</Text>
                    )}
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.ptDescription}>{item.description}</Text>
                ) : null}

                {features.length > 0 && (
                  <View style={styles.featuresContainer}>
                    {features.map((feat, idx) => (
                      <View key={idx} style={styles.featureItemRow}>
                        <Check size={12} color="#C084FC" style={styles.featureCheckIcon} />
                        <Text style={styles.featureItemText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      togglePTPlanActive(item);
                    }}
                    style={[
                      styles.statusToggleBtn,
                      item.active ? styles.activeBtn : styles.inactiveBtn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        { color: item.active ? colors.success : colors.textMuted },
                      ]}
                    >
                      {item.active ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.rightActions}>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        setSelectedPTPlan(item);
                        setShowPTModal(true);
                      }}
                      style={styles.iconActionBtn}
                    >
                      <Edit size={16} color={colors.gold} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        haptics.warning();
                        handleDeletePTPlan(item);
                      }}
                      style={[styles.iconActionBtn, styles.deleteBtn]}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <FVEEmptyState
              icon={<Dumbbell size={40} color={colors.gold} />}
              title="No PT Packages Yet"
              description="Define personal training packages with custom session counts, duration, and fees."
              actionTitle="+ Create PT Package"
              onAction={() => {
                setSelectedPTPlan(null);
                setShowPTModal(true);
              }}
            />
          }
        />
      ) : (
        /* PLAN UPGRADE REQUESTS LIST */
        <View style={{ flex: 1 }}>
          {/* Filter Header */}
          <View style={styles.upgradeFilterHeader}>
            {/* Search Input */}
            <View style={styles.searchBar}>
              <Search size={14} color={colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search member name, ID, or phone..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 4 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Chips */}
            <View style={styles.filterChipRow}>
              {(['ALL', 'PENDING', 'COMPLETED', 'REJECTED'] as const).map((st) => {
                const isSelected = upgradeStatusFilter === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => {
                      haptics.selection();
                      setUpgradeStatusFilter(st);
                    }}
                    style={[styles.statusChip, isSelected && styles.statusChipActive]}
                  >
                    <Text style={[styles.statusChipText, isSelected && styles.statusChipTextActive]}>
                      {st === 'ALL' ? 'All' : st}
                    </Text>
                    {st === 'PENDING' && pendingRequestsCount > 0 && (
                      <View style={styles.pendingChipBadge}>
                        <Text style={styles.pendingChipBadgeText}>{pendingRequestsCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Requests FlatList */}
          <FlatList
            data={filteredRequests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={requestsLoading} onRefresh={onRefresh} tintColor={colors.gold} />
            }
            renderItem={({ item }) => {
              const currentPlanName = item.current_plan?.name || 'Previous Plan';
              const requestedPlanName = item.requested_plan?.name || 'Requested Plan';
              const memberName = item.members?.full_name || 'Member';
              const memberInitial = memberName.charAt(0).toUpperCase();

              return (
                <View style={styles.requestCard}>
                  {/* Member & Status Header */}
                  <View style={styles.requestHeader}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('MemberDetail', { memberId: item.member_id })}
                      style={styles.requestMemberInfo}
                      activeOpacity={0.7}
                    >
                      <View style={styles.requestAvatar}>
                        <Text style={styles.requestAvatarText}>{memberInitial}</Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.requestMemberName}>{memberName}</Text>
                          {item.members?.member_id && (
                            <View style={styles.memberIdPill}>
                              <Text style={styles.memberIdPillText}>{item.members.member_id}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.requestDateText}>
                          Requested {formatDate(item.created_at)}
                          {item.requested_by_role ? ` · By ${item.requested_by_role}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.reqStatusBadge,
                        item.status === 'PENDING'
                          ? styles.reqStatusPending
                          : item.status === 'COMPLETED'
                          ? styles.reqStatusCompleted
                          : styles.reqStatusRejected,
                      ]}
                    >
                      {item.status === 'PENDING' ? (
                        <Clock size={11} color={colors.warning} />
                      ) : item.status === 'COMPLETED' ? (
                        <CheckCircle2 size={11} color={colors.success} />
                      ) : (
                        <Ban size={11} color={colors.error} />
                      )}
                      <Text
                        style={[
                          styles.reqStatusBadgeText,
                          item.status === 'PENDING'
                            ? { color: colors.warning }
                            : item.status === 'COMPLETED'
                            ? { color: colors.success }
                            : { color: colors.error },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  {/* Plan Progression Arrow */}
                  <View style={styles.planFlowBox}>
                    <Text style={styles.oldPlanText}>{currentPlanName}</Text>
                    <ArrowRight size={13} color={colors.gold} />
                    <Text style={styles.newPlanText}>{requestedPlanName}</Text>
                    {item.calculated_expiry_date && (
                      <Text style={styles.expiryTag}>
                        · Until{' '}
                        <Text style={{ color: colors.success }}>
                          {formatDate(item.calculated_expiry_date)}
                        </Text>
                      </Text>
                    )}
                  </View>

                  {/* Notes / Reason */}
                  {item.notes ? <Text style={styles.reqNotesText}>"{item.notes}"</Text> : null}
                  {item.rejection_reason ? (
                    <Text style={styles.reqRejectionText}>
                      Rejection Reason: {item.rejection_reason}
                    </Text>
                  ) : null}

                  {/* Financial Details & Actions Footer */}
                  <View style={styles.requestFooter}>
                    <View>
                      <Text style={styles.footerBalanceLabel}>BALANCE DUE</Text>
                      <Text style={styles.footerBalanceVal}>
                        {formatCurrency(Number(item.balance_amount) || 0)}
                      </Text>
                      <Text style={styles.footerPaidSub}>
                        Already Paid: {formatCurrency(Number(item.amount_already_paid) || 0)}
                      </Text>
                    </View>

                    <View style={styles.footerActionsRow}>
                      {item.status === 'PENDING' && isOwnerOrAdmin && (
                        <TouchableOpacity
                          onPress={() => {
                            haptics.selection();
                            setSelectedRequestForModal(item);
                          }}
                          style={styles.collectActionBtn}
                          activeOpacity={0.8}
                        >
                          <CreditCard size={13} color={colors.background} />
                          <Text style={styles.collectActionBtnText}>Collect & Upgrade</Text>
                        </TouchableOpacity>
                      )}

                      {item.status === 'COMPLETED' && item.payment_id && (
                        <TouchableOpacity
                          onPress={() => {
                            haptics.light();
                            if (item.payments) {
                              navigation.navigate('PaymentReceipt', { payment: item.payments });
                            } else {
                              navigation.navigate('MemberDetail', { memberId: item.member_id });
                            }
                          }}
                          style={styles.receiptActionBtn}
                          activeOpacity={0.7}
                        >
                          <FileText size={13} color={colors.gold} />
                          <Text style={styles.receiptActionBtnText}>Receipt</Text>
                        </TouchableOpacity>
                      )}

                      {item.status === 'COMPLETED' && item.members?.mobile && (
                        <TouchableOpacity
                          onPress={() => {
                            const message = buildPlanUpgradeWhatsAppMessage(
                              memberName,
                              currentPlanName,
                              requestedPlanName,
                              item.balance_amount,
                              item.calculated_expiry_date || '',
                              undefined
                            );
                            openWhatsAppLink(item.members!.mobile!, message);
                          }}
                          style={styles.whatsAppActionBtn}
                          activeOpacity={0.7}
                        >
                          <MessageCircle size={15} color="#25D366" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <FVEEmptyState
                icon={<Sparkles size={40} color={colors.gold} />}
                title={
                  upgradeStatusFilter === 'PENDING'
                    ? 'No Pending Requests'
                    : 'No Upgrade Requests'
                }
                description={
                  upgradeStatusFilter === 'PENDING'
                    ? 'There are no pending plan upgrade requests requiring approval at this time.'
                    : 'Members can request plan upgrades from their profile card or front desk.'
                }
              />
            }
          />
        </View>
      )}

      {/* Plan Upgrade / Change Modal */}
      {selectedRequestForModal &&
        selectedRequestForModal.members &&
        selectedRequestForModal.memberships && (
          <PlanChangeModal
            visible={!!selectedRequestForModal}
            onClose={() => setSelectedRequestForModal(null)}
            member={selectedRequestForModal.members}
            activeMembership={selectedRequestForModal.memberships}
            existingRequest={selectedRequestForModal}
            onSuccess={() => {
              setSelectedRequestForModal(null);
              onRefresh();
            }}
          />
        )}

      {/* Membership Plan Modal */}
      <PlanFormModal
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSaved={onRefresh}
        plan={selectedPlan}
      />

      {/* Personal Training Plan Modal */}
      <PTPlanFormModal
        visible={showPTModal}
        onClose={() => setShowPTModal(false)}
        onSaved={onRefresh}
        plan={selectedPTPlan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0E1114',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.gold,
  },
  tabButtonText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  tabButtonTextActive: {
    color: colors.background,
    fontWeight: '700',
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  planCard: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.28)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  ptCardBorder: {
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  inactiveCard: {
    opacity: 0.6,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  planTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  planName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  durationText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  planPrice: {
    color: colors.gold,
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  ptPerSessionSubtitle: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  ptDescription: {
    fontFamily: typography.fonts.inter,
    fontSize: 12,
    color: '#8A92A6',
    marginTop: 6,
  },
  limitBadge: {
    backgroundColor: colors.goldMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  limitText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    marginTop: 12,
  },
  statusToggleBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBtn: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successMuted,
  },
  inactiveBtn: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusToggleText: {
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.goldMuted,
  },
  deleteBtn: {
    backgroundColor: colors.errorMuted,
  },
  featuresContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  featureCheckIcon: {
    flexShrink: 0,
  },
  featureItemText: {
    color: '#BFC3C7',
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    flex: 1,
  },
  upgradeFilterHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    padding: 0,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    color: colors.textMuted,
  },
  statusChipTextActive: {
    color: colors.background,
  },
  pendingChipBadge: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pendingChipBadgeText: {
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    color: colors.gold,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 14,
    color: colors.gold,
  },
  requestMemberName: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 14,
    color: colors.textPrimary,
  },
  memberIdPill: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  memberIdPillText: {
    fontSize: 9,
    fontFamily: typography.fonts.inter,
    fontWeight: '700',
    color: colors.gold,
  },
  requestDateText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  reqStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  reqStatusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  reqStatusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  reqStatusRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  reqStatusBadgeText: {
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
  },
  planFlowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceLight,
    padding: 8,
    borderRadius: 8,
    flexWrap: 'wrap',
  },
  oldPlanText: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  newPlanText: {
    fontSize: 12,
    fontFamily: typography.fonts.rajdhani,
    color: colors.textPrimary,
  },
  expiryTag: {
    fontSize: 11,
    color: colors.textMuted,
  },
  reqNotesText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  reqRejectionText: {
    fontSize: 11,
    color: colors.error,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  footerBalanceLabel: {
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  footerBalanceVal: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 14,
    color: colors.gold,
  },
  footerPaidSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  collectActionBtnText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    color: colors.background,
  },
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  receiptActionBtnText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    color: colors.gold,
  },
  whatsAppActionBtn: {
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.3)',
    padding: 6,
  },
});
