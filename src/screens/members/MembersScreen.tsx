import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users, Filter, X, ArrowUpDown, AlertCircle } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { MemberCard } from '@/components/features/MemberCard';
import { MemberFormModal } from '@/components/features/MemberFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { SkeletonMemberCard } from '@/components/common/FVESkeleton';
import { MemberWithMembership } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { RootStackParamList } from '@/navigation/types';

import { haptics } from '@/utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { buildExpiredAlertMessage, openWhatsAppLink } from '@/utils/format';
import { getLocalDateStr } from '@/utils/date';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function MembersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name_asc' | 'expiry_asc' | 'join_desc'>('name_asc');
  const [showAddModal, setShowAddModal] = useState(false);

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Expired members count query for live badge on the "EXPIRED" filter chip
  const { data: expiredCount = 0 } = useQuery({
    queryKey: ['mobile-members-expired-count'],
    queryFn: async () => {
      const todayStr = getLocalDateStr();
      try {
        const { count, error } = await supabase
          .from('members_with_membership')
          .select('*', { count: 'exact', head: true })
          .or(`membership_status.eq.EXPIRED,expiry_sort_group.eq.2,membership_expiry_date.lt.${todayStr}`);
        if (!error && typeof count === 'number') {
          return count;
        }
      } catch {
        // Fallback below
      }
      const { count: fallbackCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .or(`status.eq.EXPIRED,expiry_date.lt.${todayStr}`);
      return fallbackCount || 0;
    },
    staleTime: 30000,
  });

  // Query members from members_with_membership view (or join with members)
  const { data: members, isLoading, refetch } = useQuery({
    queryKey: ['mobile-members', debouncedSearch, statusFilter, genderFilter, sortBy],
    queryFn: async () => {
      let q = supabase.from('members_with_membership').select('*');

      if (sortBy === 'name_asc') {
        q = q.order('full_name', { ascending: true });
      } else if (sortBy === 'expiry_asc') {
        q = q.order('membership_expiry_date', { ascending: true, nullsFirst: false });
      } else if (sortBy === 'join_desc') {
        q = q.order('joining_date', { ascending: false });
      }

      if (debouncedSearch.trim()) {
        q = q.or(
          `full_name.ilike.%${search.trim()}%,mobile.ilike.%${search.trim()}%,member_id.ilike.%${search.trim()}%`
        );
      }

      if (statusFilter === 'EXPIRED') {
        const todayStr = getLocalDateStr();
        q = q.or(`membership_status.eq.EXPIRED,expiry_sort_group.eq.2,membership_expiry_date.lt.${todayStr}`);
      } else if (statusFilter === 'ACTIVE') {
        const todayStr = getLocalDateStr();
        q = q.or(`membership_status.eq.ACTIVE,expiry_sort_group.eq.1,membership_expiry_date.gte.${todayStr}`);
      } else if (statusFilter !== 'ALL') {
        q = q.eq('membership_status', statusFilter);
      }

      if (genderFilter !== 'ALL') {
        q = q.eq('gender', genderFilter);
      }

      const { data, error } = await q;

      if (error) {
        let fallbackQuery = supabase.from('members').select('*');
        if (sortBy === 'join_desc') {
          fallbackQuery = fallbackQuery.order('joining_date', { ascending: false });
        } else {
          fallbackQuery = fallbackQuery.order('full_name', { ascending: true });
        }
        if (debouncedSearch.trim()) {
          fallbackQuery = fallbackQuery.or(
            `full_name.ilike.%${search.trim()}%,mobile.ilike.%${search.trim()}%,member_id.ilike.%${search.trim()}%`
          );
        }
        if (genderFilter !== 'ALL') {
          fallbackQuery = fallbackQuery.eq('gender', genderFilter);
        }
        const fallbackRes = await fallbackQuery;
        return (fallbackRes.data || []) as MemberWithMembership[];
      }

      return (data || []) as MemberWithMembership[];
    },
  });

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-members'] });
    qc.invalidateQueries({ queryKey: ['mobile-members-expired-count'] });
  }, [qc]);

  // Handler for individual member WhatsApp renewal alert
  const handleSendWhatsAppAlert = (member: MemberWithMembership) => {
    if (!member.mobile) {
      haptics.error();
      Alert.alert(
        'No Mobile Number',
        `No mobile phone number is recorded for ${member.full_name || 'this member'}.`
      );
      return;
    }
    haptics.medium();
    const message = buildExpiredAlertMessage(
      member.full_name,
      member.plan_name,
      member.membership_expiry_date
    );
    openWhatsAppLink(member.mobile, message);
  };

  const statusFilters = ['ALL', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'HOLD'];

  const handleStatusSelect = (status: string) => {
    haptics.selection();
    setStatusFilter(status);
  };

  const handleSortToggle = () => {
    haptics.selection();
    if (sortBy === 'name_asc') setSortBy('expiry_asc');
    else if (sortBy === 'expiry_asc') setSortBy('join_desc');
    else setSortBy('name_asc');
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="MEMBERS"
        subtitle={`${members?.length || 0} registered members`}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowAddModal(true);
            }}
            style={styles.addHeaderBtn}
          >
            <UserPlus size={16} color={colors.gold} />
            <Text style={styles.addHeaderBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.searchSection}>
        {/* Search Box */}
        <FVEInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, ID, or mobile..."
          leftIcon={<Search size={18} color={colors.gold} />}
          rightIcon={
            search ? <X size={16} color={colors.textSecondary} /> : undefined
          }
          onRightIconPress={() => setSearch('')}
          containerStyle={styles.searchContainer}
        />

        {/* Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {statusFilters.map(status => {
            const isSelected = statusFilter === status;
            const isExpiredChip = status === 'EXPIRED';
            const label =
              isExpiredChip && expiredCount > 0
                ? `EXPIRED (${expiredCount})`
                : status.replace('_', ' ');

            return (
              <TouchableOpacity
                key={status}
                onPress={() => handleStatusSelect(status)}
                style={[
                  styles.filterChip,
                  isSelected && styles.selectedFilterChip,
                  isExpiredChip && isSelected && styles.selectedExpiredChip,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.selectedFilterChipText,
                    isExpiredChip && isSelected && styles.selectedExpiredChipText,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort Controls */}
        <View style={styles.sortRow}>
          <View style={styles.sortLeft}>
            <ArrowUpDown size={13} color={colors.gold} />
            <Text style={styles.sortLabel}>SORT BY:</Text>
          </View>
          <TouchableOpacity
            onPress={handleSortToggle}
            style={styles.sortBtn}
          >
            <Text style={styles.sortBtnText}>
              {sortBy === 'name_asc'
                ? 'Name (A-Z)'
                : sortBy === 'expiry_asc'
                ? 'Expiry (Soonest)'
                : 'Recently Joined'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expired Members Alert Banner (Indicator) */}
      {statusFilter === 'EXPIRED' && (
        <View style={styles.expiredBanner}>
          <View style={styles.expiredBannerIconBox}>
            <AlertCircle size={20} color="#F87171" />
          </View>
          <View style={styles.expiredBannerContent}>
            <View style={styles.expiredBannerHeader}>
              <Text style={styles.expiredBannerTitle}>EXPIRED MEMBERS LIST</Text>
              <View style={styles.expiredCountBadge}>
                <Text style={styles.expiredCountBadgeText}>
                  {members?.length || 0} expired
                </Text>
              </View>
            </View>
            <Text style={styles.expiredBannerText}>
              Tap the WhatsApp Alert button on any member card below to notify them directly for renewal.
            </Text>
          </View>
        </View>
      )}

      {/* Member List */}
      {isLoading ? (
        <FVELogoLoader message="Syncing Members..." fullScreen />
      ) : (
        <FlatList
          data={members || []}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              onPress={() =>
                navigation.navigate('MemberDetail', {
                  memberId: item.id,
                  initialMember: item,
                })
              }
              onWhatsAppAlert={handleSendWhatsAppAlert}
            />
          )}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<Users size={40} color={colors.gold} />}
              title="No Members Found"
              description={
                search
                  ? `No members matching "${search}"`
                  : 'Start by registering your first gym member.'
              }
              actionTitle="+ Register Member"
              onAction={() => setShowAddModal(true)}
            />
          ) : null
        }
      />
      )}

      {/* Native Floating Action Button (FAB) */}
      <TouchableOpacity
        onPress={() => {
          haptics.medium();
          setShowAddModal(true);
        }}
        activeOpacity={0.85}
        style={styles.fab}
      >
        <LinearGradient
          colors={[colors.goldBright, colors.gold, colors.goldDark]}
          style={styles.fabGradient}
        >
          <Plus size={24} color="#050505" strokeWidth={3} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Member Modal */}
      <MemberFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
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
  addHeaderBtn: {
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
  addHeaderBtnText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#080A0D',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchContainer: {
    marginBottom: 10,
  },
  filterScroll: {
    paddingBottom: 10,
  },
  filterChip: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  selectedFilterChip: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  selectedExpiredChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  selectedFilterChipText: {
    color: colors.gold,
  },
  selectedExpiredChipText: {
    color: '#F87171',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127, 29, 29, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    gap: 12,
  },
  expiredBannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredBannerContent: {
    flex: 1,
  },
  expiredBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  expiredBannerTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  expiredCountBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  expiredCountBadgeText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  expiredBannerText: {
    color: '#BFC3C7',
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    lineHeight: 15,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sortBtn: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortBtnText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    borderRadius: 30,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

