import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Award, Edit, Trash2, Check, Clock, Dumbbell, Calendar } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { PlanFormModal } from '@/components/features/PlanFormModal';
import { PTPlanFormModal } from '@/components/features/PTPlanFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { MembershipPlan, PersonalTrainingPlan } from '@/types';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency, parseFeatures } from '@/utils/format';
import { haptics } from '@/utils/haptics';

export function MembershipPlansScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getPlansStyles(colors, isDark), [colors, isDark]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'membership' | 'pt'>('membership');

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

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mobile-membership-plans'] });
    qc.invalidateQueries({ queryKey: ['mobile-pt-plans'] });
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

  const isLoading = activeTab === 'membership' ? plansLoading : ptPlansLoading;

  return (
    <View style={styles.container}>
      <FVEHeader
        title="GYM & PT PLANS"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
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
          <Award size={14} color={activeTab === 'membership' ? colors.background : colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'membership' && styles.tabButtonTextActive]}>
            MEMBER PLANS ({plans?.filter(p => p.active).length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('pt');
          }}
          style={[styles.tabButton, activeTab === 'pt' && styles.tabButtonActive]}
        >
          <Dumbbell size={14} color={activeTab === 'pt' ? colors.background : colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'pt' && styles.tabButtonTextActive]}>
            PT PACKAGES ({ptPlans?.filter(p => p.active).length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <FVELogoLoader message={activeTab === 'membership' ? "Syncing Plans..." : "Syncing PT Packages..."} fullScreen />
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
      ) : (
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
                        {item.total_sessions} Sessions · {item.duration_days} Days
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.planPrice}>{formatCurrency(numPrice)}</Text>
                </View>

                {perSession > 0 && (
                  <Text style={styles.ptPerSessionSubtitle}>
                    ≈ ₹{perSession} per session
                  </Text>
                )}

                {item.description ? (
                  <Text style={styles.ptDescription}>{item.description}</Text>
                ) : null}

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

const getPlansStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 6,
      borderRadius: 10,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.borderDark,
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
      color: '#050505',
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
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.28)' : 'rgba(217, 130, 0, 0.25)',
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 6,
      elevation: 3,
    },
    ptCardBorder: {
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.3)',
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
      color: colors.textSecondary,
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
      borderTopColor: colors.borderDark,
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
      borderColor: colors.borderDark,
      backgroundColor: colors.surface,
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
      borderTopColor: colors.borderDark,
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
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      flex: 1,
    },
  });
