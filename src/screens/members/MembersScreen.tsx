import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Linking,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users, Filter, X, ArrowUpDown, AlertCircle, Check, ChevronDown, UserCheck } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { MemberCard } from '@/components/features/MemberCard';
import { MemberFormModal } from '@/components/features/MemberFormModal';
import { ProfilePhotoModal } from '@/components/features/ProfilePhotoModal';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { SkeletonMemberCard } from '@/components/common/FVESkeleton';
import { Member, MemberWithMembership } from '@/types';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { RootStackParamList } from '@/navigation/types';

import { haptics } from '@/utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { buildExpiredAlertMessage, buildExpiryReminderMessage, openWhatsAppLink } from '@/utils/format';
import { getLocalDateStr } from '@/utils/date';
import { markRenewalMessageSent } from '@/utils/renewalMessaging';
import {
  buildMemberPdfData,
  shareMemberPassPdfToWhatsApp,
  buildMemberSubscriptionClipboardText,
} from '@/utils/memberPdf';

interface RawJoinedMembership {
  id: string;
  start_date: string;
  expiry_date: string;
  status: string | null;
  created_at: string;
  visit_day_limit?: number | null;
  visit_days_used?: number | null;
  membership_plans: { name: string } | null;
}

interface RawJoinedMember extends Member {
  memberships?: RawJoinedMembership[];
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type MemberSortOption =
  | 'expiry_asc'
  | 'expiry_desc'
  | 'expired_first'
  | 'name_asc'
  | 'name_desc'
  | 'id_asc'
  | 'id_desc'
  | 'join_desc'
  | 'join_asc';

export const SORT_OPTIONS: { id: MemberSortOption; label: string; desc: string }[] = [
  { id: 'expiry_asc', label: 'Soonest Expiry First', desc: 'Active athletes expiring soonest appear first' },
  { id: 'expiry_desc', label: 'Latest Expiry First', desc: 'Active memberships furthest in future appear first' },
  { id: 'expired_first', label: 'Expired Members First', desc: 'Lapsed athlete memberships appear at top' },
  { id: 'name_asc', label: 'Name (A → Z)', desc: 'Alphabetical athlete order from A to Z' },
  { id: 'name_desc', label: 'Name (Z → A)', desc: 'Reverse alphabetical athlete order from Z to A' },
  { id: 'id_asc', label: 'Member ID (Ascending)', desc: 'From lowest athlete ID to highest (e.g. FVE-01)' },
  { id: 'id_desc', label: 'Member ID (Descending)', desc: 'From highest athlete ID to lowest (e.g. FVE-99)' },
  { id: 'join_desc', label: 'Recently Joined First', desc: 'Newest gym athlete registrations appear first' },
  { id: 'join_asc', label: 'Oldest Joined First', desc: 'Earliest founding gym athlete registrations' },
];

function parseMemberIdNum(id?: string | null): number {
  if (!id) return 999999999;
  const match = id.match(/\d+/);
  if (!match) return 999999999;
  const num = parseInt(match[0], 10);
  return isNaN(num) ? 999999999 : num;
}

export function MembersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getMembersStyles(colors, isDark), [colors, isDark]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<MemberSortOption>('expiry_asc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewMember, setPreviewMember] = useState<MemberWithMembership | null>(null);
  const [sharingMemberId, setSharingMemberId] = useState<string | null>(null);

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Query all members directly with their memberships and plans (resilient direct join matching web app)
  const { data: allMembers = [], isLoading, refetch } = useQuery({
    queryKey: ['mobile-members', debouncedSearch, genderFilter, sortBy],
    queryFn: async () => {
      let q = supabase
        .from('members')
        .select('*, memberships(id, start_date, expiry_date, status, created_at, visit_day_limit, visit_days_used, membership_plans(name))');

      if (debouncedSearch.trim()) {
        q = q.or(
          `full_name.ilike.%${debouncedSearch.trim()}%,mobile.ilike.%${debouncedSearch.trim()}%,member_id.ilike.%${debouncedSearch.trim()}%`
        );
      }

      if (genderFilter !== 'ALL') {
        q = q.eq('gender', genderFilter);
      }

      const { data, error } = await q;

      if (error) {
        console.error('Error fetching members:', error.message);
        return [];
      }

      const rawMembers = (data || []) as unknown as RawJoinedMember[];
      const todayStr = getLocalDateStr();

      const mappedMembers: MemberWithMembership[] = rawMembers.map(m => {
        const list = [...(m.memberships || [])].sort((a, b) => {
          const aRank = a.status === 'ACTIVE' || a.status === 'EXPIRING_SOON' ? 4 : a.status === 'HOLD' ? 3 : a.status === 'UPCOMING' ? 2 : 1;
          const bRank = b.status === 'ACTIVE' || b.status === 'EXPIRING_SOON' ? 4 : b.status === 'HOLD' ? 3 : b.status === 'UPCOMING' ? 2 : 1;
          if (aRank !== bRank) return bRank - aRank;
          return (b.expiry_date || '').localeCompare(a.expiry_date || '');
        });

        const latest = list[0];
        const expiry = latest?.expiry_date || null;
        let group = 3;
        if (expiry) {
          group = expiry >= todayStr ? 1 : 2;
        }

        const upcoming = (m.memberships || []).find(ms => ms.status === 'UPCOMING');

        // Determine computed status:
        let computedStatus = latest?.status || 'NONE';
        if (latest?.status === 'HOLD') {
          computedStatus = 'HOLD';
        } else if (latest?.status === 'UPCOMING' || (latest?.start_date && latest.start_date > todayStr)) {
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

        return {
          ...m,
          full_name: (m.full_name || (m as any).name || '').trim() || 'Member',
          membership_id: latest?.id || null,
          membership_start_date: latest?.start_date || null,
          membership_expiry_date: expiry,
          membership_status: computedStatus,
          plan_name: latest?.membership_plans?.name || null,
          expiry_sort_group: group,
          visit_day_limit: latest?.visit_day_limit ?? null,
          visit_days_used: latest?.visit_days_used ?? 0,
          upcoming_membership_id: upcoming?.id || null,
          upcoming_plan_name: upcoming?.membership_plans?.name || null,
          upcoming_start_date: upcoming?.start_date || null,
          upcoming_expiry_date: upcoming?.expiry_date || null,
          has_upcoming_membership: !!upcoming,
        };
      });

      // Apply sorting for all 9 criteria matching web
      mappedMembers.sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return (a.full_name || '').localeCompare(b.full_name || '');
          case 'name_desc':
            return (b.full_name || '').localeCompare(a.full_name || '');
          case 'id_asc': {
            const aNum = parseMemberIdNum(a.member_id);
            const bNum = parseMemberIdNum(b.member_id);
            if (aNum !== bNum) return aNum - bNum;
            return (a.member_id || '').localeCompare(b.member_id || '');
          }
          case 'id_desc': {
            const aNum = parseMemberIdNum(a.member_id);
            const bNum = parseMemberIdNum(b.member_id);
            if (aNum === 999999999 && bNum === 999999999) return 0;
            if (aNum === 999999999) return 1;
            if (bNum === 999999999) return -1;
            if (aNum !== bNum) return bNum - aNum;
            return (b.member_id || '').localeCompare(a.member_id || '');
          }
          case 'join_desc':
            return (b.joining_date || '').localeCompare(a.joining_date || '');
          case 'join_asc':
            return (a.joining_date || '').localeCompare(b.joining_date || '');
          case 'expiry_desc': {
            if (a.membership_expiry_date && b.membership_expiry_date) {
              return b.membership_expiry_date.localeCompare(a.membership_expiry_date);
            }
            if (a.membership_expiry_date && !b.membership_expiry_date) return -1;
            if (!a.membership_expiry_date && b.membership_expiry_date) return 1;
            return (b.created_at || '').localeCompare(a.created_at || '');
          }
          case 'expired_first': {
            const aExp = a.expiry_sort_group === 2 ? 1 : 0;
            const bExp = b.expiry_sort_group === 2 ? 1 : 0;
            if (aExp !== bExp) return bExp - aExp;
            if (a.membership_expiry_date && b.membership_expiry_date) {
              return b.membership_expiry_date.localeCompare(a.membership_expiry_date);
            }
            return (b.created_at || '').localeCompare(a.created_at || '');
          }
          case 'expiry_asc':
          default: {
            if (a.expiry_sort_group !== b.expiry_sort_group) {
              return (a.expiry_sort_group || 3) - (b.expiry_sort_group || 3);
            }
            if (a.membership_expiry_date && b.membership_expiry_date) {
              return a.membership_expiry_date.localeCompare(b.membership_expiry_date);
            }
            if (a.membership_expiry_date && !b.membership_expiry_date) return -1;
            if (!a.membership_expiry_date && b.membership_expiry_date) return 1;
            return (b.created_at || '').localeCompare(a.created_at || '');
          }
        }
      });

      return mappedMembers;
    },
  });

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-members'] });
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
    const isExpiringSoon = member.membership_status === 'EXPIRING_SOON';
    let message: string;
    if (isExpiringSoon && member.membership_expiry_date) {
      const daysLeft = Math.ceil(
        (new Date(member.membership_expiry_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      message = buildExpiryReminderMessage(
        member.full_name,
        member.plan_name,
        member.membership_expiry_date,
        Math.max(0, daysLeft)
      );
      if (member.membership_id) {
        markRenewalMessageSent(member.membership_id, member.membership_expiry_date, member.id);
      }
    } else {
      message = buildExpiredAlertMessage(
        member.full_name,
        member.plan_name,
        member.membership_expiry_date
      );
    }
    openWhatsAppLink(member.mobile, message);
  };

  const handleChat = useCallback((member: MemberWithMembership) => {
    if (!member.mobile) {
      haptics.error();
      Alert.alert(
        'No Mobile Number',
        `No mobile number is recorded for ${member.full_name || 'this member'}. Please update their profile first.`
      );
      return;
    }
    haptics.light();
    const cleanPhone = member.mobile.replace(/\D/g, '');
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${phone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to Open WhatsApp', 'WhatsApp is not installed or could not be opened on this device.');
    });
  }, []);

  const handleShareMember = async (member: MemberWithMembership) => {
    if (sharingMemberId) return;
    if (!member.mobile) {
      haptics.error();
      Alert.alert(
        'No Mobile Number',
        'This member does not have a registered mobile number. Please update their profile with a valid WhatsApp phone number.'
      );
      return;
    }

    setSharingMemberId(member.id);
    haptics.medium();
    try {
      const memberMessage = buildMemberSubscriptionClipboardText(member);
      const pdfData = buildMemberPdfData(member);
      await shareMemberPassPdfToWhatsApp(pdfData, member.mobile, memberMessage);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (!msg.includes('Another share request')) {
        haptics.error();
        Alert.alert('Share on WhatsApp', msg || 'Failed to open the member WhatsApp chat.');
      }
    } finally {
      setSharingMemberId(null);
    }
  };

  const statusFilters = ['ALL', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'HOLD', 'UPCOMING'];

  const handleStatusSelect = (status: string) => {
    haptics.selection();
    setStatusFilter(status);
  };

  const handleSortPress = () => {
    haptics.selection();
    setShowSortModal(true);
  };

  const todayStr = getLocalDateStr();

  // Tab counts dynamically calculated from the full dataset
  const counts = {
    ALL: allMembers.length,
    ACTIVE: allMembers.filter(
      m => m.membership_status === 'ACTIVE' ||
        (!!m.membership_expiry_date && m.membership_expiry_date >= todayStr && m.membership_status !== 'HOLD' && m.membership_status !== 'EXPIRED')
    ).length,
    EXPIRING_SOON: allMembers.filter(m => m.membership_status === 'EXPIRING_SOON').length,
    EXPIRED: allMembers.filter(
      m => m.membership_status === 'EXPIRED' ||
        m.expiry_sort_group === 2 ||
        (!!m.membership_expiry_date && m.membership_expiry_date < todayStr)
    ).length,
    HOLD: allMembers.filter(m => m.membership_status === 'HOLD').length,
    UPCOMING: allMembers.filter(m => m.has_upcoming_membership || m.membership_status === 'UPCOMING').length,
  };

  // Filter members by the selected tab
  const members = allMembers.filter(m => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') {
      return (
        m.membership_status === 'ACTIVE' ||
        (!!m.membership_expiry_date && m.membership_expiry_date >= todayStr && m.membership_status !== 'HOLD' && m.membership_status !== 'EXPIRED')
      );
    }
    if (statusFilter === 'EXPIRED') {
      return (
        m.membership_status === 'EXPIRED' ||
        m.expiry_sort_group === 2 ||
        (!!m.membership_expiry_date && m.membership_expiry_date < todayStr)
      );
    }
    if (statusFilter === 'EXPIRING_SOON') {
      return m.membership_status === 'EXPIRING_SOON';
    }
    if (statusFilter === 'HOLD') {
      return m.membership_status === 'HOLD';
    }
    if (statusFilter === 'UPCOMING') {
      return m.has_upcoming_membership || m.membership_status === 'UPCOMING';
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <FVEHeader
        title="MEMBERS"
        subtitle={
          statusFilter === 'ALL'
            ? `${counts.ACTIVE} Active · ${allMembers.length} Total Members`
            : `${members.length} ${statusFilter.replace('_', ' ')} · ${counts.ACTIVE} Active of ${allMembers.length} Total`
        }
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
            const isActiveChip = status === 'ACTIVE';
            const count = counts[status as keyof typeof counts] || 0;
            const displayStatus = status === 'ACTIVE'
              ? 'ACTIVE'
              : status === 'UPCOMING'
              ? 'ADVANCE QUEUED'
              : status.replace('_', ' ');
            const label = `${displayStatus} (${count})`;

            return (
              <TouchableOpacity
                key={status}
                onPress={() => handleStatusSelect(status)}
                style={[
                  styles.filterChip,
                  isSelected && styles.selectedFilterChip,
                  isActiveChip && isSelected && styles.selectedActiveChip,
                  isExpiredChip && isSelected && styles.selectedExpiredChip,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  {status === 'ACTIVE' && (
                    <UserCheck size={11} color={isSelected ? '#10B981' : colors.textSecondary} />
                  )}
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.selectedFilterChipText,
                      isActiveChip && isSelected && styles.selectedActiveChipText,
                      isExpiredChip && isSelected && styles.selectedExpiredChipText,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Gender Filter Chips */}
        <View style={styles.genderRow}>
          <Text style={styles.genderLabel}>GENDER:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genderScrollContent}
          >
            {[
              { id: 'ALL', label: 'All Gender' },
              { id: 'Male', label: 'Male' },
              { id: 'Female', label: 'Female' },
              { id: 'Other', label: 'Other' },
            ].map((g) => {
              const isSelected = genderFilter === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => {
                    haptics.selection();
                    setGenderFilter(g.id);
                  }}
                  style={[
                    styles.genderChip,
                    isSelected && styles.genderChipSelected,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.genderChipText,
                      isSelected && styles.genderChipTextSelected,
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sort Controls */}
        <View style={styles.sortRow}>
          <View style={styles.sortLeft}>
            <ArrowUpDown size={13} color={colors.gold} />
            <Text style={styles.sortLabel}>SORT BY:</Text>
          </View>
          <TouchableOpacity
            onPress={handleSortPress}
            style={styles.sortBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.sortBtnText}>
              {SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Soonest Expiry First'}
            </Text>
            <ChevronDown size={13} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expiring Soon Alert Banner */}
      {statusFilter === 'EXPIRING_SOON' && (
        <View style={[styles.expiredBanner, styles.expiringBanner]}>
          <View style={[styles.expiredBannerIconBox, styles.expiringBannerIconBox]}>
            <AlertCircle size={20} color="#FBBF24" />
          </View>
          <View style={styles.expiredBannerContent}>
            <View style={styles.expiredBannerHeader}>
              <Text style={[styles.expiredBannerTitle, styles.expiringBannerTitle]}>EXPIRING SOON LIST</Text>
              <View style={[styles.expiredCountBadge, styles.expiringCountBadge]}>
                <Text style={[styles.expiredCountBadgeText, styles.expiringCountBadgeText]}>
                  {members?.length || 0} expiring
                </Text>
              </View>
            </View>
            <Text style={styles.expiredBannerText}>
              Tap the WhatsApp Remind button on any member card below to send a proactive renewal reminder.
            </Text>
          </View>
        </View>
      )}

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
              onShare={handleShareMember}
              isSharing={sharingMemberId === item.id}
              onWhatsAppAlert={handleSendWhatsAppAlert}
              onChat={handleChat}
              onAvatarPress={(m) => setPreviewMember(m)}
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

      {/* Full-Size Profile Photo Modal */}
      <ProfilePhotoModal
        visible={!!previewMember}
        onClose={() => setPreviewMember(null)}
        photoUrl={previewMember?.profile_photo}
        memberName={previewMember?.full_name || ''}
        memberId={previewMember?.member_id}
      />

      {/* Sort Options Modal */}
      <FVEModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        title="SORT ATHLETES"
        subtitle="Select sorting criteria matching web dashboard"
      >
        <View style={styles.sortModalScroll}>
          {SORT_OPTIONS.map((opt) => {
            const isSelected = sortBy === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  haptics.selection();
                  setSortBy(opt.id);
                  setShowSortModal(false);
                }}
                style={[
                  styles.sortOptionItem,
                  isSelected && styles.sortOptionItemActive,
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.sortOptionTextContainer}>
                  <Text
                    style={[
                      styles.sortOptionTitle,
                      isSelected && styles.sortOptionTitleActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.sortOptionDesc}>{opt.desc}</Text>
                </View>
                <View
                  style={[
                    styles.sortRadioCircle,
                    isSelected && styles.sortRadioCircleActive,
                  ]}
                >
                  {isSelected && <Check size={14} color="#050505" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </FVEModal>
    </View>
  );
}

const getMembersStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      backgroundColor: isDark ? '#080A0D' : colors.cardBackground,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDark,
    },
    searchContainer: {
      marginBottom: 10,
    },
    filterScroll: {
      paddingBottom: 10,
    },
    filterChip: {
      backgroundColor: isDark ? '#11141A' : colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      marginRight: 8,
    },
    selectedFilterChip: {
      backgroundColor: colors.goldMuted,
      borderColor: colors.goldBorder,
    },
    selectedExpiredChip: {
      backgroundColor: colors.errorMuted,
      borderColor: colors.errorBorder,
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
      color: colors.error,
    },
    selectedActiveChip: {
      backgroundColor: 'rgba(16, 185, 129, 0.18)',
      borderColor: '#10B981',
    },
    selectedActiveChipText: {
      color: '#10B981',
    },
    expiredBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(127, 29, 29, 0.22)' : '#FEF2F2',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(220, 38, 38, 0.3)',
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
      backgroundColor: colors.errorMuted,
      borderWidth: 1,
      borderColor: colors.errorBorder,
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
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    expiredCountBadge: {
      backgroundColor: colors.errorMuted,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    expiredCountBadgeText: {
      color: colors.error,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    expiredBannerText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      lineHeight: 15,
    },
    // Amber overrides for Expiring Soon banner
    expiringBanner: {
      backgroundColor: isDark ? 'rgba(120, 80, 0, 0.2)' : '#FFFBEB',
      borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.3)',
    },
    expiringBannerIconBox: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    expiringBannerTitle: {
      color: isDark ? '#FBBF24' : '#92400E',
    },
    expiringCountBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    expiringCountBadgeText: {
      color: isDark ? '#FBBF24' : '#B45309',
    },
    genderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderDark,
    },
    genderLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginRight: 8,
    },
    genderScrollContent: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    genderChip: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: isDark ? '#11141A' : colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    genderChipSelected: {
      backgroundColor: colors.goldMuted,
      borderColor: colors.gold,
    },
    genderChipText: {
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    genderChipTextSelected: {
      color: colors.gold,
      fontWeight: '700',
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderDark,
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
      backgroundColor: isDark ? '#11141A' : colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sortBtnText: {
      color: colors.gold,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    sortModalScroll: {
      marginBottom: 4,
    },
    sortOptionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: isDark ? '#11141A' : colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      marginBottom: 8,
    },
    sortOptionItemActive: {
      backgroundColor: colors.goldMuted,
      borderColor: colors.gold,
    },
    sortOptionTextContainer: {
      flex: 1,
      marginRight: 12,
    },
    sortOptionTitle: {
      fontSize: 14,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    sortOptionTitleActive: {
      color: colors.gold,
    },
    sortOptionDesc: {
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      color: colors.textMuted,
    },
    sortRadioCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.borderDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortRadioCircleActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
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
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    fabGradient: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
