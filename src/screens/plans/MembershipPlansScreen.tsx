import React, { useState, useCallback } from 'react';
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
import { Plus, Award, Edit, Trash2, Check, Clock } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { PlanFormModal } from '@/components/features/PlanFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { MembershipPlan } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';

export function MembershipPlansScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  const { data: plans, isLoading, refetch } = useQuery({
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

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mobile-membership-plans'] });
  }, [qc]);

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

  return (
    <View style={styles.container}>
      <FVEHeader
        title="MEMBERSHIP PLANS"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              setSelectedPlan(null);
              setShowPlanModal(true);
            }}
            style={styles.addBtn}
          >
            <Plus size={16} color={colors.gold} />
            <Text style={styles.addBtnText}>New</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={plans || []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.planCard, !item.active && styles.inactiveCard]}>
            <View style={styles.planHeader}>
              <View style={styles.planTitleContainer}>
                <Text style={styles.planName}>{item.name}</Text>
                <View style={styles.durationRow}>
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={styles.durationText}>
                    {item.duration_days} Days ({item.duration_type || 'STANDARD'})
                  </Text>
                </View>
              </View>

              <Text style={styles.planPrice}>{formatCurrency(item.price)}</Text>
            </View>

            {item.visit_day_limit != null && (
              <View style={styles.limitBadge}>
                <Text style={styles.limitText}>
                  Max {item.visit_day_limit} usable visit days
                </Text>
              </View>
            )}

            {/* Actions Bar */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() => togglePlanActive(item)}
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
                    setSelectedPlan(item);
                    setShowPlanModal(true);
                  }}
                  style={styles.iconActionBtn}
                >
                  <Edit size={16} color={colors.gold} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeletePlan(item)}
                  style={[styles.iconActionBtn, styles.deleteBtn]}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
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
          ) : null
        }
      />

      <PlanFormModal
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSaved={onRefresh}
        plan={selectedPlan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
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
});
