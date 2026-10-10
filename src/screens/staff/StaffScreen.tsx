import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Shield,
  Search,
  X,
  MoreVertical,
  LogIn,
  Edit,
  Trash2,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEModal } from '@/components/common/FVEModal';
import { StaffFormModal } from '@/components/features/StaffFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { UserProfile, UserRole } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { ROLE_DISPLAY_NAMES } from '@/constants/permissions';
import { haptics } from '@/utils/haptics';

const ROLE_ORDER: { role: UserRole; title: string }[] = [
  { role: 'OWNER', title: 'OWNERS' },
  { role: 'ADMIN', title: 'ADMINISTRATORS' },
  { role: 'TRAINER', title: 'TRAINERS' },
  { role: 'RECEPTIONIST', title: 'RECEPTIONISTS' },
  { role: 'ATTENDANCE_SCANNER', title: 'ATTENDANCE SCANNERS' },
];

export function StaffScreen() {
  const navigation = useNavigation();
  const { user, activateStaffProfile, clearStaffProfile } = useAuth();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStaffStyles(colors, isDark), [colors, isDark]);

  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
  const [activeMenuStaff, setActiveMenuStaff] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: staffList, isLoading } = useQuery({
    queryKey: ['mobile-staff-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as UserProfile[];
    },
  });

  const filteredStaff = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return staffList || [];
    return (staffList || []).filter(s =>
      (s.full_name || '').toLowerCase().includes(term) ||
      (s.username || '').toLowerCase().includes(term) ||
      (s.role || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term)
    );
  }, [staffList, debouncedSearch]);

  const sections = useMemo(() => {
    const list = filteredStaff || [];
    return ROLE_ORDER.map(group => {
      const matching = list.filter(
        s => (s.role || '').toUpperCase() === group.role
      );
      return {
        title: group.title,
        role: group.role,
        data: matching,
      };
    }).filter(s => s.data.length > 0);
  }, [filteredStaff]);

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-staff-list'] });
  }, [qc]);

  const handleSwitchProfile = (profile: UserProfile) => {
    Alert.alert(
      'Switch Profile Mode',
      `Operate FitVerse Elite as ${profile.full_name || profile.username} (${ROLE_DISPLAY_NAMES[profile.role as UserRole] || profile.role})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await activateStaffProfile(profile);
            Alert.alert(
              'Profile Switched',
              `Active profile: ${profile.full_name || profile.username}`
            );
          },
        },
      ]
    );
  };

  const handleDeleteStaff = (profile: UserProfile) => {
    if (profile.role === 'OWNER') {
      Alert.alert('Restricted', 'Cannot delete the Primary Owner profile.');
      return;
    }

    Alert.alert(
      'Delete Staff Profile',
      `Remove ${profile.full_name || profile.username} from staff roster?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', profile.id);
              if (error) throw error;
              onRefresh();
            } catch (err: unknown) {
              Alert.alert(
                'Error',
                (err as Error).message || 'Failed to remove staff'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="STAFF DIRECTORY"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              setSelectedStaff(null);
              setShowModal(true);
            }}
            style={styles.addBtn}
          >
            <Plus size={16} color={colors.gold} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {/* Active Mode Notice */}
      {user?.isStaffProfile && (
        <View style={styles.activeStaffBanner}>
          <Text style={styles.activeBannerText}>
            Operating as: {user.full_name || user.username} ({user.role})
          </Text>
          <TouchableOpacity
            onPress={() => clearStaffProfile()}
            style={styles.returnBtn}
          >
            <Text style={styles.returnBtnText}>Return to Owner</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FVEInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or role..."
          leftIcon={<Search size={16} color={colors.gold} />}
          rightIcon={search ? <X size={16} color={colors.textSecondary} /> : undefined}
          onRightIconPress={() => setSearch('')}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {isLoading ? (
        <FVELogoLoader message="Syncing Staff..." fullScreen />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
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
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                {section.title} ({section.data.length})
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isCurrentActive = user?.id === item.id;
            const staffName = (item.full_name || item.username || 'Staff Profile').toUpperCase();
            const staffEmail = item.email || item.phone || 'No email specified';

            return (
              <View style={styles.staffRow}>
                <View style={styles.rowMainCol}>
                  {/* Fixed Row Line 1: Name + Role (+ Subtle (You) marker) */}
                  <View style={styles.nameLine}>
                    <Text style={styles.staffName} numberOfLines={1}>
                      {staffName}
                    </Text>
                    {isCurrentActive && (
                      <View style={styles.youMarkerBadge}>
                        <Text style={styles.youMarkerText}>You</Text>
                      </View>
                    )}
                    {/* Exactly one role label */}
                    <FVEBadge role={item.role} size="sm" />
                  </View>

                  {/* Fixed Row Line 2: Email */}
                  <Text style={styles.staffEmail} numberOfLines={1}>
                    {staffEmail}
                  </Text>
                </View>

                {/* ⋮ Options Menu */}
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setActiveMenuStaff(item);
                  }}
                  style={styles.moreBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Options for ${item.full_name || item.username}`}
                >
                  <MoreVertical size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            !isLoading ? (
              <FVEEmptyState
                icon={<Shield size={40} color={colors.gold} />}
                title="No Staff Found"
                description={
                  debouncedSearch
                    ? 'No team members match your search criteria.'
                    : 'Add trainers, receptionists, or attendance kiosks.'
                }
                actionTitle="+ Add Staff"
                onAction={() => {
                  setSelectedStaff(null);
                  setShowModal(true);
                }}
              />
            ) : null
          }
        />
      )}

      {/* Staff Options Modal (⋮) */}
      <FVEModal
        visible={!!activeMenuStaff}
        onClose={() => setActiveMenuStaff(null)}
        title="STAFF OPTIONS"
        subtitle={activeMenuStaff?.full_name || activeMenuStaff?.username || undefined}
      >
        {activeMenuStaff && (
          <View style={styles.modalMenuContent}>
            {/* Operate profile (if not current active user and not owner) */}
            {user?.id !== activeMenuStaff.id && activeMenuStaff.role !== 'OWNER' && (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  const staffToSwitch = activeMenuStaff;
                  setActiveMenuStaff(null);
                  handleSwitchProfile(staffToSwitch);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: colors.goldMuted, borderColor: colors.goldBorder }]}>
                  <LogIn size={16} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Operate Account</Text>
                  <Text style={styles.menuItemSub}>
                    Temporarily switch session to this staff role
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Edit staff */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                const staffToEdit = activeMenuStaff;
                setActiveMenuStaff(null);
                setSelectedStaff(staffToEdit);
                setShowModal(true);
              }}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: colors.goldMuted, borderColor: colors.goldBorder }]}>
                <Edit size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Edit Details</Text>
                <Text style={styles.menuItemSub}>Update full name, contact, or assigned role</Text>
              </View>
            </TouchableOpacity>

            {/* Delete staff (only non-owner) */}
            {activeMenuStaff.role !== 'OWNER' && (
              <TouchableOpacity
                style={[styles.menuItem, { borderColor: 'rgba(239, 68, 68, 0.25)' }]}
                activeOpacity={0.7}
                onPress={() => {
                  const staffToDelete = activeMenuStaff;
                  setActiveMenuStaff(null);
                  handleDeleteStaff(staffToDelete);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Trash2 size={16} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemTitle, { color: colors.error }]}>Delete Staff</Text>
                  <Text style={styles.menuItemSub}>Permanently remove from staff roster</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </FVEModal>

      <StaffFormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={onRefresh}
        staff={selectedStaff}
      />
    </View>
  );
}

const getStaffStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    activeStaffBanner: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(217, 130, 0, 0.12)',
      borderBottomWidth: 1,
      borderBottomColor: colors.goldBorder,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activeBannerText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    returnBtn: {
      backgroundColor: colors.gold,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    returnBtnText: {
      color: '#050505',
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 4,
    },
    listContent: {
      paddingBottom: 40,
    },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      backgroundColor: colors.background,
    },
    sectionHeaderText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    // Fixed row height: name + role, then email
    staffRow: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDark,
    },
    rowMainCol: {
      flex: 1,
      marginRight: 12,
      justifyContent: 'center',
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 3,
    },
    staffName: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      flexShrink: 1,
    },
    youMarkerBadge: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.16)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    youMarkerText: {
      color: colors.gold,
      fontSize: 9,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    staffEmail: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
    },
    moreBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    modalMenuContent: {
      gap: 8,
      paddingBottom: 12,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    menuIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    menuItemTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    menuItemSub: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
  });
