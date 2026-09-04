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
import { Plus, Shield, User, Phone, Mail, LogIn, Edit, Trash2 } from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEBadge } from '@/components/common/FVEBadge';
import { StaffFormModal } from '@/components/features/StaffFormModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { UserProfile, UserRole } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { ROLE_DISPLAY_NAMES } from '@/constants/permissions';

export function StaffScreen() {
  const navigation = useNavigation();
  const { user, ownerUser, activateStaffProfile, clearStaffProfile } = useAuth();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);

  const { data: staffList, isLoading, refetch } = useQuery({
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

  const onRefresh = useCallback(() => {
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
            Alert.alert('Profile Switched', `Active profile: ${profile.full_name || profile.username}`);
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
              Alert.alert('Error', (err as Error).message || 'Failed to remove staff');
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

      <FlatList
        data={staffList || []}
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
        renderItem={({ item }) => {
          const isCurrentActive = user?.id === item.id;
          const isOwner = item.role === 'OWNER';

          return (
            <View style={[styles.staffCard, isCurrentActive && styles.activeCard]}>
              <View style={styles.staffHeader}>
                <View style={styles.leftCol}>
                  <Text style={styles.staffName}>
                    {item.full_name || item.username || 'Staff Profile'}
                  </Text>
                  <FVEBadge role={item.role} size="sm" style={{ marginTop: 4 }} />
                </View>

                {isCurrentActive ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE SESSION</Text>
                  </View>
                ) : (
                  !isOwner && (
                    <TouchableOpacity
                      onPress={() => handleSwitchProfile(item)}
                      style={styles.switchBtn}
                    >
                      <LogIn size={13} color={colors.gold} />
                      <Text style={styles.switchBtnText}>Operate</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <View style={styles.contactDetails}>
                {item.email ? (
                  <View style={styles.detailRow}>
                    <Mail size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>{item.email}</Text>
                  </View>
                ) : null}

                {item.phone ? (
                  <View style={styles.detailRow}>
                    <Phone size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>{item.phone}</Text>
                  </View>
                ) : null}
              </View>

              {!isOwner && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedStaff(item);
                      setShowModal(true);
                    }}
                    style={styles.actionIconBtn}
                  >
                    <Edit size={14} color={colors.gold} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteStaff(item)}
                    style={[styles.actionIconBtn, styles.deleteActionBtn]}
                  >
                    <Trash2 size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<Shield size={40} color={colors.gold} />}
              title="No Staff Members"
              description="Add trainers, receptionists, or attendance kiosks."
              actionTitle="+ Add Staff"
              onAction={() => {
                setSelectedStaff(null);
                setShowModal(true);
              }}
            />
          ) : null
        }
      />

      <StaffFormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={onRefresh}
        staff={selectedStaff}
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
  activeStaffBanner: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: colors.goldBorder,
    padding: 12,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  returnBtnText: {
    color: '#050505',
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  staffCard: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.22)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  activeCard: {
    borderColor: colors.gold,
    backgroundColor: '#141820',
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leftCol: {
    flex: 1,
  },
  staffName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  switchBtnText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: colors.successMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: colors.success,
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  contactDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.goldMuted,
  },
  deleteActionBtn: {
    backgroundColor: colors.errorMuted,
  },
});
