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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  QrCode,
  UserCheck,
  Search,
  Calendar,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { AttendanceItem } from '@/components/features/AttendanceItem';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVEModal } from '@/components/common/FVEModal';
import { Attendance, Member } from '@/types';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { getLocalDateStr, formatDate } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AttendanceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const todayStr = getLocalDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'QR' | 'MANUAL'>('ALL');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  const handlePrevDay = () => {
    haptics.light();
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalDateStr(d));
  };

  const handleNextDay = () => {
    if (selectedDate >= todayStr) return;
    haptics.light();
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(getLocalDateStr(d));
  };

  const handleToday = () => {
    haptics.medium();
    setSelectedDate(todayStr);
  };

  // Fetch Attendance Log for Selected Date
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['mobile-attendance-log', selectedDate, methodFilter, search],
    queryFn: async () => {
      let q = supabase
        .from('attendance')
        .select('*, members!inner(full_name, profile_photo, member_id)')
        .eq('date', selectedDate)
        .order('check_in_time', { ascending: false });

      if (methodFilter !== 'ALL') {
        q = q.eq('check_in_method', methodFilter);
      }

      if (search.trim()) {
        q = q.ilike('members.full_name', `%${search.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Attendance[];
    },
    refetchInterval: 15000,
  });

  // Fetch all active members for manual check-in
  const { data: allMembers } = useQuery({
    queryKey: ['all-members-attendance'],
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('id, full_name, mobile, member_id')
        .order('full_name');
      return (data || []) as Member[];
    },
    enabled: showManualModal,
  });

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-attendance-log'] });
  }, [qc]);

  // Handle manual member check-in
  const handleManualCheckIn = async (member: Member) => {
    setManualLoading(true);
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Insert check-in record
      const { error } = await supabase.from('attendance').insert({
        member_id: member.id,
        date: selectedDate,
        check_in_time: timeStr,
        marked_by: user?.id || null,
        check_in_method: 'MANUAL',
        created_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === '23505') {
          haptics.warning();
          Alert.alert('Already Checked In', `${member.full_name} has already checked in on this date.`);
          return;
        }
        haptics.error();
        throw error;
      }

      haptics.success();
      Alert.alert('Success', `Checked in ${member.full_name} successfully!`);
      setShowManualModal(false);
      onRefresh();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Check-In Error', (err as Error).message || 'Failed to check in member');
    } finally {
      setManualLoading(false);
    }
  };

  const handleFilterSelect = (tab: 'ALL' | 'QR' | 'MANUAL') => {
    haptics.selection();
    setMethodFilter(tab);
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="ATTENDANCE LOG"
        subtitle={`${selectedDate === todayStr ? 'Today' : formatDate(selectedDate)}: ${logs?.length || 0} checked in`}
      />

      {/* Date Navigation Bar */}
      <View style={styles.dateNavBar}>
        <TouchableOpacity
          onPress={handlePrevDay}
          style={styles.dateNavBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={colors.gold} />
        </TouchableOpacity>

        <View style={styles.dateInfoContainer}>
          <Calendar size={14} color={colors.gold} style={{ marginRight: 6 }} />
          <Text style={styles.dateInfoText}>
            {selectedDate === todayStr ? 'Today · ' : ''}
            {formatDate(selectedDate)}
          </Text>
        </View>

        <View style={styles.dateNavRight}>
          {selectedDate !== todayStr && (
            <TouchableOpacity onPress={handleToday} style={styles.todayPill}>
              <Text style={styles.todayPillText}>TODAY</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNextDay}
            disabled={selectedDate >= todayStr}
            style={[styles.dateNavBtn, selectedDate >= todayStr && styles.dateNavBtnDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight
              size={20}
              color={selectedDate >= todayStr ? colors.textMuted : colors.gold}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons: Camera QR Scan & Manual */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          onPress={() => {
            haptics.medium();
            navigation.navigate('QRScanner');
          }}
          style={styles.scanButton}
          activeOpacity={0.85}
        >
          <QrCode size={20} color="#050505" />
          <Text style={styles.scanButtonText}>CAMERA SCANNER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setShowManualModal(true);
          }}
          style={styles.manualButton}
          activeOpacity={0.85}
        >
          <UserCheck size={18} color={colors.gold} />
          <Text style={styles.manualButtonText}>Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs — animated sliding pill */}
      <View style={styles.filterSection}>
        <View style={styles.tabButtonsRow}>
          {(['ALL', 'QR', 'MANUAL'] as const).map(tab => {
            const isSelected = methodFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => handleFilterSelect(tab)}
                style={styles.tabBtn}
                activeOpacity={0.8}
              >
                {isSelected && <View style={styles.selectedTabPill} />}
                <Text
                  style={[
                    styles.tabBtnText,
                    isSelected && styles.selectedTabBtnText,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FVEInput
          value={search}
          onChangeText={setSearch}
          placeholder="Filter by member name..."
          leftIcon={<Search size={16} color={colors.gold} />}
          containerStyle={{ marginBottom: 0, marginTop: 8 }}
        />
      </View>

      {/* Attendance List */}
      <FlatList
        data={logs || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <AttendanceItem item={item} />}
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
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<UserCheck size={40} color={colors.gold} />}
              title="No Check-Ins Yet"
              description="Members checking in via QR or manual registration will appear here."
              actionTitle="Scan Member QR"
              onAction={() => navigation.navigate('QRScanner')}
            />
          ) : null
        }
      />

      {/* Manual Check-in Modal */}
      <FVEModal
        visible={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Manual Check-In"
        subtitle="Select a member to register check-in for today"
      >
        <View style={styles.manualList}>
          {(allMembers || []).map(m => (
            <TouchableOpacity
              key={m.id}
              onPress={() => handleManualCheckIn(m)}
              disabled={manualLoading}
              style={styles.manualMemberItem}
            >
              <View>
                <Text style={styles.manualMemberName}>{m.full_name}</Text>
                {m.member_id && (
                  <Text style={styles.manualMemberId}>#{m.member_id}</Text>
                )}
              </View>
              <CheckCircle size={20} color={colors.gold} />
            </TouchableOpacity>
          ))}
        </View>
      </FVEModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  dateNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F1318',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 161, 0, 0.15)',
  },
  dateNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
  },
  dateNavBtnDisabled: {
    opacity: 0.35,
  },
  dateInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInfoText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.gold,
  },
  todayPillText: {
    color: '#050505',
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  actionsBar: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    gap: 10,
  },
  scanButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  scanButtonText: {
    color: '#050505',
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  manualButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingVertical: 13,
  },
  manualButtonText: {
    color: colors.gold,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  selectedTabPill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 161, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.38)',
  },
  tabBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  selectedTabBtnText: {
    color: colors.gold,
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  manualList: {
    paddingBottom: 20,
  },
  manualMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  manualMemberName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  manualMemberId: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
});
