import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import {
  QrCode,
  UserCheck,
  Search,
  X,
  Calendar,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Share2,
  FileSpreadsheet,
  AlertTriangle,
  UserX,
  MessageCircle,
  Clock,
  Ban,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEModal } from '@/components/common/FVEModal';
import { AttendanceItem } from '@/components/features/AttendanceItem';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { AttendanceCalendarModal } from '@/components/features/AttendanceCalendarModal';
import { AttendanceFollowUpModal } from '@/components/features/AttendanceFollowUpModal';
import { ProfilePhotoModal } from '@/components/features/ProfilePhotoModal';
import { Attendance, Member, Membership } from '@/types';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { getLocalDateStr, getLocalMonthStr, formatDate, normalizeMembershipStatus } from '@/utils/date';
import { visitLimitStatus, consumeVisitDay } from '@/utils/visitLimit';
import { useAuth } from '@/contexts/AuthContext';
import { haptics } from '@/utils/haptics';
import { sounds } from '@/utils/sounds';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type AttendanceMode = 'LOG' | 'MONITORING';
type CheckInMethod = 'ALL' | 'QR' | 'MANUAL';
export type MonitoringTab = 'ALL' | 'ACTIVE' | 'PRESENT' | 'ABSENT' | 'EXPIRED';

interface MonitoringMember {
  id: string;
  full_name: string;
  member_id?: string | null;
  mobile?: string | null;
  profile_photo?: string | null;
  qr_code?: string | null;
  plan_name?: string | null;
  checkedInToday: boolean;
  checkInTime?: string | null;
  checkInMethod?: string | null;
  lastCheckInDate?: string | null;
  consecutiveAbsentDays: number;
  isContinuousAbsent: boolean;
  isActive: boolean;
  isExpired: boolean;
  membershipStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'HOLD' | 'UPCOMING' | 'NONE';
  activeMembership?: Membership | null;
}

export function AttendanceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getAttendanceStyles(colors, isDark), [colors, isDark]);

  const todayStr = getLocalDateStr();
  const [mode, setMode] = useState<AttendanceMode>('LOG');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<CheckInMethod>('ALL');

  // Member Monitoring Search & Filters
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitoringFilter, setMonitoringFilter] = useState<MonitoringTab>('ALL');
  const [followUpMember, setFollowUpMember] = useState<MonitoringMember | null>(null);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [manualFilter, setManualFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [selectedMemberForCalendar, setSelectedMemberForCalendar] = useState<{
    id: string;
    full_name: string;
    member_id?: string | null;
  } | null>(null);
  const [previewPhotoMember, setPreviewPhotoMember] = useState<{
    profile_photo?: string | null;
    full_name: string;
    member_id?: string | null;
  } | null>(null);
  const [selectedMemberForQR, setSelectedMemberForQR] = useState<Member | MonitoringMember | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search 400ms to avoid excessive filtering
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

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
  const { data: rawLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['mobile-attendance-log', selectedDate, methodFilter],
    queryFn: async () => {
      let q = supabase
        .from('attendance')
        .select('*, members!inner(full_name, profile_photo, member_id)')
        .eq('date', selectedDate)
        .order('check_in_time', { ascending: false });

      if (methodFilter !== 'ALL') {
        q = q.eq('check_in_method', methodFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Attendance[];
    },
    refetchInterval: 15000,
  });

  // Client-side search filter: name, member_id
  const logs = useMemo(() => {
    if (!rawLogs) return [];
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return rawLogs;
    return rawLogs.filter(item => {
      const name = (item.members?.full_name || '').toLowerCase();
      const memberId = (item.members?.member_id || '').toLowerCase();
      return name.includes(term) || memberId.includes(term);
    });
  }, [rawLogs, debouncedSearch]);

  // Fetch all members with their memberships and today's attendance for Monitoring Mode
  const { data: monitoringMembers = [], isLoading: monitoringLoading, refetch: refetchMonitoring } = useQuery({
    queryKey: ['monitoring-attendance-members', todayStr],
    queryFn: async () => {
      const [membersRes, attendanceTodayRes, allAttendanceRes] = await Promise.all([
        supabase
          .from('members')
          .select('id, full_name, member_id, mobile, profile_photo, qr_code, created_at, memberships(id, start_date, expiry_date, status, visit_day_limit, visit_days_used, membership_plans(name))')
          .order('full_name', { ascending: true }),
        supabase
          .from('attendance')
          .select('id, member_id, check_in_time, check_in_method')
          .eq('date', todayStr),
        supabase
          .from('attendance')
          .select('member_id, date, check_in_time')
          .order('date', { ascending: false }),
      ]);

      if (membersRes.error) throw membersRes.error;

      const attendanceMap = new Map<string, { check_in_time: string; check_in_method: string }>();
      (attendanceTodayRes.data || []).forEach(a => {
        attendanceMap.set(a.member_id, {
          check_in_time: a.check_in_time,
          check_in_method: a.check_in_method || 'MANUAL',
        });
      });

      const latestAttendanceMap = new Map<string, { date: string; check_in_time: string }>();
      (allAttendanceRes.data || []).forEach(a => {
        if (!latestAttendanceMap.has(a.member_id)) {
          latestAttendanceMap.set(a.member_id, {
            date: a.date,
            check_in_time: a.check_in_time,
          });
        }
      });

      const list: MonitoringMember[] = (membersRes.data || []).map(m => {
        const msList = (m.memberships || []).sort((a: any, b: any) => {
          const aRank = ['ACTIVE', 'EXPIRING_SOON'].includes(a.status || '') ? 4 : a.status === 'HOLD' ? 3 : a.status === 'UPCOMING' ? 2 : 1;
          const bRank = ['ACTIVE', 'EXPIRING_SOON'].includes(b.status || '') ? 4 : b.status === 'HOLD' ? 3 : b.status === 'UPCOMING' ? 2 : 1;
          if (aRank !== bRank) return bRank - aRank;
          return (b.expiry_date || '').localeCompare(a.expiry_date || '');
        });

        // 1. Identify active membership valid for today
        const activeMs = msList.find((ms: any) => {
          const norm = normalizeMembershipStatus(ms.status, ms.expiry_date, ms.start_date);
          return (norm === 'ACTIVE' || norm === 'EXPIRING_SOON') &&
            (!ms.start_date || ms.start_date <= todayStr) &&
            (!ms.expiry_date || ms.expiry_date >= todayStr);
        }) || null;

        const latestMs = msList[0] || null;
        const normalizedLatest = latestMs
          ? normalizeMembershipStatus(latestMs.status, latestMs.expiry_date, latestMs.start_date)
          : null;

        const isActive = Boolean(activeMs);
        const isExpired = !isActive && Boolean(
          normalizedLatest === 'EXPIRED' ||
          (latestMs?.expiry_date && latestMs.expiry_date < todayStr) ||
          latestMs?.status === 'EXPIRED' ||
          msList.length === 0
        );

        let membershipStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'HOLD' | 'UPCOMING' | 'NONE' = 'NONE';
        if (isActive && activeMs) {
          membershipStatus = normalizeMembershipStatus(activeMs.status, activeMs.expiry_date, activeMs.start_date) || 'ACTIVE';
        } else if (latestMs) {
          membershipStatus = normalizedLatest || (latestMs.status as any) || 'NONE';
        }

        const att = attendanceMap.get(m.id);
        const isPresentToday = Boolean(att);
        const latestAtt = latestAttendanceMap.get(m.id);

        let consecutiveAbsentDays = 0;
        if (!isPresentToday) {
          if (latestAtt?.date) {
            const diffMs = new Date(todayStr).getTime() - new Date(latestAtt.date).getTime();
            consecutiveAbsentDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          } else if (activeMs?.start_date) {
            const diffMs = new Date(todayStr).getTime() - new Date(activeMs.start_date).getTime();
            consecutiveAbsentDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          } else if (m.created_at) {
            const diffMs = new Date(todayStr).getTime() - new Date(m.created_at).getTime();
            consecutiveAbsentDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          } else {
            consecutiveAbsentDays = 3;
          }
        }

        const isContinuousAbsent = !isPresentToday && consecutiveAbsentDays >= 3;

        return {
          id: m.id,
          full_name: m.full_name,
          member_id: m.member_id,
          mobile: m.mobile,
          profile_photo: m.profile_photo,
          qr_code: m.qr_code,
          plan_name: ((activeMs || latestMs)?.membership_plans as { name?: string } | null)?.name || null,
          checkedInToday: isPresentToday,
          checkInTime: att?.check_in_time || null,
          checkInMethod: att?.check_in_method || null,
          lastCheckInDate: latestAtt?.date || null,
          consecutiveAbsentDays,
          isContinuousAbsent,
          isActive,
          isExpired,
          membershipStatus,
          activeMembership: (activeMs as unknown as Membership) || null,
        };
      });

      return list;
    },
    refetchInterval: 15000,
  });

  // Tab Counts dynamically derived from monitoringMembers
  const totalCount = monitoringMembers.length;
  const activeCount = monitoringMembers.filter(m => m.isActive).length;
  const presentCount = monitoringMembers.filter(m => m.checkedInToday).length;
  const absentCount = monitoringMembers.filter(m => m.isActive && !m.checkedInToday).length;
  const expiredCount = monitoringMembers.filter(m => m.isExpired).length;

  // Filtered monitoring members according to selected tab and search query
  const filteredMonitoring = useMemo(() => {
    let list = monitoringMembers;
    if (monitoringFilter === 'ACTIVE') {
      list = list.filter(m => m.isActive);
    } else if (monitoringFilter === 'PRESENT') {
      list = list.filter(m => m.checkedInToday);
    } else if (monitoringFilter === 'ABSENT') {
      list = list.filter(m => m.isActive && !m.checkedInToday);
    } else if (monitoringFilter === 'EXPIRED') {
      list = list.filter(m => m.isExpired);
    }

    const term = monitorSearch.trim().toLowerCase();
    if (!term) return list;
    return list.filter(m =>
      m.full_name.toLowerCase().includes(term) ||
      (m.member_id || '').toLowerCase().includes(term) ||
      (m.mobile || '').includes(term)
    );
  }, [monitoringMembers, monitorSearch, monitoringFilter]);

  const totalPreview = useMemo(
    () => monitoringMembers.slice(0, 2).map(m => m.full_name),
    [monitoringMembers]
  );
  const activePreview = useMemo(
    () => monitoringMembers.filter(m => m.isActive).slice(0, 2).map(m => m.full_name),
    [monitoringMembers]
  );
  const presentPreview = useMemo(
    () => monitoringMembers.filter(m => m.checkedInToday).slice(0, 2).map(m => m.full_name),
    [monitoringMembers]
  );
  const absentPreview = useMemo(
    () => monitoringMembers.filter(m => m.isActive && !m.checkedInToday).slice(0, 2).map(m => m.full_name),
    [monitoringMembers]
  );
  const expiredPreview = useMemo(
    () => monitoringMembers.filter(m => m.isExpired).slice(0, 2).map(m => m.full_name),
    [monitoringMembers]
  );

  // Fetch all members with memberships for manual check-in modal to enforce Active Rule
  const { data: allMembers = [] } = useQuery({
    queryKey: ['manual-checkin-members', todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, mobile, member_id, profile_photo, qr_code, memberships(id, start_date, expiry_date, status, visit_day_limit, visit_days_used, membership_plans(name))')
        .order('full_name', { ascending: true });

      if (error) throw error;

      type MemberWithComputed = Member & {
        isActive: boolean;
        isExpired: boolean;
        planName: string | null;
        activeMembership?: any;
      };

      const members: MemberWithComputed[] = (data || []).map((m: any) => {
        const msList = (m.memberships || []).sort((a: any, b: any) => {
          const aRank = ['ACTIVE', 'EXPIRING_SOON'].includes(a.status || '') ? 4 : a.status === 'HOLD' ? 3 : a.status === 'UPCOMING' ? 2 : 1;
          const bRank = ['ACTIVE', 'EXPIRING_SOON'].includes(b.status || '') ? 4 : b.status === 'HOLD' ? 3 : b.status === 'UPCOMING' ? 2 : 1;
          if (aRank !== bRank) return bRank - aRank;
          return (b.expiry_date || '').localeCompare(a.expiry_date || '');
        });

        const activeMs = msList.find((ms: any) => {
          const norm = normalizeMembershipStatus(ms.status, ms.expiry_date, ms.start_date);
          return (norm === 'ACTIVE' || norm === 'EXPIRING_SOON') &&
            (!ms.start_date || ms.start_date <= todayStr) &&
            (!ms.expiry_date || ms.expiry_date >= todayStr);
        }) || null;

        const latestMs = msList[0] || null;
        const normalizedLatest = latestMs
          ? normalizeMembershipStatus(latestMs.status, latestMs.expiry_date, latestMs.start_date)
          : null;

        const isActive = Boolean(activeMs);
        const isExpired = !isActive && Boolean(
          normalizedLatest === 'EXPIRED' ||
          (latestMs?.expiry_date && latestMs.expiry_date < todayStr) ||
          latestMs?.status === 'EXPIRED' ||
          msList.length === 0
        );

        return {
          id: m.id,
          full_name: m.full_name,
          mobile: m.mobile,
          member_id: m.member_id,
          profile_photo: m.profile_photo,
          qr_code: m.qr_code,
          isActive,
          isExpired,
          planName: (activeMs || latestMs)?.membership_plans?.name || 'Standard',
          activeMembership: activeMs,
        } as MemberWithComputed;
      });

      // Sort: Active members first, then by ID / name
      members.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        const aMatch = (a.member_id || '').match(/\d+/);
        const bMatch = (b.member_id || '').match(/\d+/);
        const aNum = aMatch ? parseInt(aMatch[0], 10) : 999999999;
        const bNum = bMatch ? parseInt(bMatch[0], 10) : 999999999;
        if (aNum !== bNum) return aNum - bNum;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });

      return members;
    },
    enabled: showManualModal,
  });

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-attendance-log'] });
    qc.invalidateQueries({ queryKey: ['monitoring-attendance-members'] });
    qc.invalidateQueries({ queryKey: ['manual-checkin-members'] });
    qc.invalidateQueries({ queryKey: ['all-members-attendance'] });
    qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
  }, [qc]);

  // Handle validated manual member check-in
  const handleManualCheckIn = async (member: Member | MonitoringMember, targetDate: string = selectedDate) => {
    // Attendance Rule: Only active members should be allowed to mark attendance
    if ('isActive' in member && (member as any).isActive === false) {
      sounds.qrInvalid();
      haptics.warning();
      Alert.alert(
        'Attendance Restricted',
        `Only active members are permitted to mark attendance.\n\n${member.full_name}'s membership is ${(member as any).isExpired ? 'expired' : 'inactive'}. Please renew their subscription before checking in.`
      );
      return;
    }

    setManualLoading(true);
    try {
      // 1. Auto-activate any UPCOMING membership for this member that is due today
      const { data: upcomingDue } = await supabase
        .from('memberships')
        .select('id, start_date, expiry_date')
        .eq('member_id', member.id)
        .eq('status', 'UPCOMING')
        .lte('start_date', todayStr)
        .order('start_date', { ascending: true })
        .limit(1);

      if (upcomingDue && upcomingDue.length > 0) {
        const up = upcomingDue[0];
        await supabase
          .from('memberships')
          .update({ status: 'EXPIRED' })
          .eq('member_id', member.id)
          .neq('id', up.id)
          .in('status', ['ACTIVE', 'EXPIRING_SOON'])
          .lt('expiry_date', todayStr);

        const newStatus = normalizeMembershipStatus('ACTIVE', up.expiry_date, up.start_date) || 'ACTIVE';
        await supabase
          .from('memberships')
          .update({ status: newStatus })
          .eq('id', up.id);
      }

      // 1b. Verify active membership valid for targetDate
      const { data: memberships } = await supabase
        .from('memberships')
        .select('id, start_date, expiry_date, status, visit_day_limit, visit_days_used')
        .eq('member_id', member.id)
        .in('status', ['ACTIVE', 'EXPIRING_SOON'])
        .lte('start_date', targetDate)
        .gte('expiry_date', targetDate)
        .order('expiry_date', { ascending: false })
        .limit(1);

      const activeMs = memberships?.[0];
      if (!activeMs || activeMs.status === 'HOLD' || (activeMs.expiry_date && activeMs.expiry_date < targetDate)) {
        sounds.qrInvalid();
        haptics.warning();
        Alert.alert(
          'Attendance Restricted',
          `Only active members are permitted to mark attendance.\n\n${member.full_name} does not have an active membership valid for ${formatDate(targetDate)}. Please renew their subscription before checking in.`
        );
        return;
      }

      // 2. Check visit day limit
      const visits = visitLimitStatus(activeMs);
      if (visits.exhausted) {
        sounds.qrInvalid();
        haptics.error();
        Alert.alert(
          'Visits Exhausted',
          `${member.full_name} has used all ${visits.limit} visit days allocated in their plan.`
        );
        return;
      }

      const now = new Date();
      const checkInTimestamp = now.toISOString();

      // 3. Upsert check-in record
      const { data: inserted, error } = await supabase
        .from('attendance')
        .upsert(
          {
            member_id: member.id,
            date: targetDate,
            check_in_time: checkInTimestamp,
            marked_by: user?.id || null,
            check_in_method: 'MANUAL',
          },
          { onConflict: 'member_id,date', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          sounds.checkinAlready();
          haptics.warning();
          Alert.alert('Already Checked In', `${member.full_name} is already checked in for this date.`);
          return;
        }
        throw error;
      }

      if (!inserted) {
        sounds.checkinAlready();
        haptics.warning();
        Alert.alert('Already Checked In', `${member.full_name} has already checked in on this date.`);
        return;
      }

      // 4. Consume visit day if limited plan
      if (visits.isLimited) {
        await consumeVisitDay(activeMs);
      }

      sounds.checkinSuccess();
      haptics.success();
      Alert.alert('Check-In Recorded', `${member.full_name} manually checked in successfully!`);
      setShowManualModal(false);
      setManualSearch('');
      onRefresh();
    } catch (err: unknown) {
      sounds.qrInvalid();
      haptics.error();
      Alert.alert('Check-In Error', (err as Error).message || 'Failed to check in member');
    } finally {
      setManualLoading(false);
    }
  };

  // Export attendance log to CSV file and share
  const handleExportCSV = async () => {
    haptics.medium();
    setExporting(true);
    try {
      const monthStr = getLocalMonthStr(new Date(selectedDate));
      const [year, month] = monthStr.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${monthStr}-01`;
      const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const { data: attData, error } = await supabase
        .from('attendance')
        .select('date, check_in_time, check_in_method, members(full_name, member_id, mobile)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false });

      if (error) throw error;

      if (!attData || attData.length === 0) {
        Alert.alert('No Records', `No attendance logs found for ${monthStr}.`);
        return;
      }

      // Build CSV text
      let csv = 'Date,Time,Member Name,Member ID,Mobile,Method\n';
      (attData as any[]).forEach((row) => {
        const d = row.date || '';
        let t = '';
        if (row.check_in_time) {
          try {
            t = new Date(row.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          } catch {
            t = row.check_in_time;
          }
        }
        const memberInfo = Array.isArray(row.members) ? row.members[0] : row.members;
        const name = `"${(memberInfo?.full_name || 'Member').replace(/"/g, '""')}"`;
        const code = `"${memberInfo?.member_id || ''}"`;
        const mob = `"${memberInfo?.mobile || ''}"`;
        const method = row.check_in_method || 'MANUAL';
        csv += `${d},${t},${name},${code},${mob},${method}\n`;
      });

      const fileUri = `${FileSystem.documentDirectory}Attendance_${monthStr}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Share Attendance Report (${monthStr})`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export Saved', `Attendance CSV generated at: ${fileUri}`);
      }
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Export Error', (err as Error).message || 'Failed to export attendance CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterSelect = (tab: CheckInMethod) => {
    haptics.selection();
    setMethodFilter(tab);
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="ATTENDANCE"
        subtitle={
          mode === 'LOG'
            ? `${selectedDate === todayStr ? 'Today' : formatDate(selectedDate)} · ${logs?.length || 0} checked in`
            : `Live Roster · ${presentCount} present, ${absentCount} absent · ${activeCount} active`
        }
        rightAction={
          <TouchableOpacity
            onPress={handleExportCSV}
            disabled={exporting}
            style={styles.exportHeaderBtn}
          >
            <FileSpreadsheet size={15} color={colors.gold} />
            <Text style={styles.exportHeaderBtnText}>CSV</Text>
          </TouchableOpacity>
        }
      />

      {/* Primary Mode Segmented Control: Daily Log vs Member Monitoring */}
      <View style={styles.modeSegmentBar}>
        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setMode('LOG');
          }}
          style={[styles.modeSegmentBtn, mode === 'LOG' && styles.modeSegmentBtnActive]}
          activeOpacity={0.8}
        >
          <Clock size={14} color={mode === 'LOG' ? '#050505' : colors.textSecondary} />
          <Text
            numberOfLines={1}
            style={[styles.modeSegmentText, mode === 'LOG' && styles.modeSegmentTextActive]}
          >
            DAILY LOG
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setMode('MONITORING');
          }}
          style={[styles.modeSegmentBtn, mode === 'MONITORING' && styles.modeSegmentBtnActive]}
          activeOpacity={0.8}
        >
          <Users size={14} color={mode === 'MONITORING' ? '#050505' : colors.textSecondary} />
          <Text
            numberOfLines={1}
            style={[styles.modeSegmentText, mode === 'MONITORING' && styles.modeSegmentTextActive]}
          >
            MEMBER ROSTER
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          MODE 1: DAILY LOG VIEW
         ───────────────────────────────────────────────────────────── */}
      {mode === 'LOG' && (
        <>
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

          {/* Filter Tabs & Search */}
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
              placeholder="Filter by member name or ID..."
              leftIcon={<Search size={16} color={colors.gold} />}
              containerStyle={{ marginBottom: 0, marginTop: 8 }}
            />
          </View>

          {/* Attendance List */}
          {logsLoading ? (
            <FVELogoLoader message="Syncing Attendance..." fullScreen />
          ) : (
            <FlatList
              data={logs || []}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <AttendanceItem
                  item={item}
                  onPress={() => {
                    if (item.members) {
                      haptics.light();
                      setSelectedMemberForCalendar({
                        id: item.member_id,
                        full_name: item.members.full_name || 'Member',
                        member_id: item.members.member_id,
                      });
                    }
                  }}
                  onAvatarPress={att => {
                    if (att.members) {
                      haptics.light();
                      setPreviewPhotoMember({
                        profile_photo: att.members.profile_photo,
                        full_name: att.members.full_name || 'Member',
                        member_id: att.members.member_id,
                      });
                    }
                  }}
                />
              )}
              contentContainerStyle={styles.listContent}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              refreshControl={
                <RefreshControl
                  refreshing={logsLoading}
                  onRefresh={onRefresh}
                  tintColor={colors.gold}
                  colors={[colors.gold]}
                />
              }
              ListEmptyComponent={
                !logsLoading ? (
                  <FVEEmptyState
                    icon={<UserCheck size={40} color={colors.gold} />}
                    title="No Check-Ins Recorded"
                    description={
                      search
                        ? `No members found matching "${search}".`
                        : 'Members checking in via QR or manual registration will appear here.'
                    }
                    actionTitle="Scan Member QR"
                    onAction={() => navigation.navigate('QRScanner')}
                  />
                ) : null
              }
            />
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 2: MEMBER MONITORING VIEW (PRESENT VS ABSENT ROSTER)
         ───────────────────────────────────────────────────────────── */}
      {mode === 'MONITORING' && (
        <View style={{ flex: 1 }}>
          {/* 5 Attendance Status Tiles */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monitorTilesContainer}
          >
            {/* Tile 1: All Members */}
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setMonitoringFilter('ALL');
              }}
              style={[
                styles.monitorTile,
                monitoringFilter === 'ALL' && styles.monitorTileActiveGold,
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.monitorTileHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Users size={13} color={colors.gold} />
                  <Text style={styles.monitorTileTitle}>ALL MEMBERS</Text>
                </View>
                {/* {monitoringFilter === 'ALL' && (
                  <View style={styles.activePillGold}>
                    <Text style={styles.activePillGoldText}>Active</Text>
                  </View>
                )} */}
              </View>
              <Text style={styles.monitorTileCount}>{totalCount}</Text>
              <Text style={styles.monitorTileSubtitle}>Total athletes</Text>
              <Text numberOfLines={1} style={styles.monitorTilePreview}>
                {totalPreview.length > 0 ? totalPreview.join(', ') : 'No members'}
              </Text>
            </TouchableOpacity>

            {/* Tile 2: Active Members */}
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setMonitoringFilter('ACTIVE');
              }}
              style={[
                styles.monitorTile,
                monitoringFilter === 'ACTIVE' && styles.monitorTileActiveBlue,
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.monitorTileHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <UserCheck size={13} color="#00D4FF" />
                  <Text style={[styles.monitorTileTitle, { color: '#00D4FF' }]}>ACTIVE</Text>
                </View>
                {monitoringFilter === 'ACTIVE' && (
                  <View style={styles.activePillBlue}>
                    <Text style={styles.activePillBlueText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.monitorTileCount, { color: '#00D4FF' }]}>{activeCount}</Text>
              <Text style={styles.monitorTileSubtitle}>Valid memberships</Text>
              <Text numberOfLines={1} style={styles.monitorTilePreview}>
                {activePreview.length > 0 ? activePreview.join(', ') : 'No active members'}
              </Text>
            </TouchableOpacity>

            {/* Tile 3: Present Today */}
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setMonitoringFilter('PRESENT');
              }}
              style={[
                styles.monitorTile,
                monitoringFilter === 'PRESENT' && styles.monitorTileActiveGreen,
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.monitorTileHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={13} color={colors.success} />
                  <Text style={[styles.monitorTileTitle, { color: colors.success }]}>PRESENT</Text>
                </View>
                {monitoringFilter === 'PRESENT' && (
                  <View style={styles.activePillGreen}>
                    <Text style={styles.activePillGreenText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.monitorTileCount, { color: colors.success }]}>{presentCount}</Text>
              <Text style={styles.monitorTileSubtitle}>Marked present today</Text>
              <Text numberOfLines={1} style={styles.monitorTilePreview}>
                {presentPreview.length > 0 ? presentPreview.join(', ') : 'No check-ins yet'}
              </Text>
            </TouchableOpacity>

            {/* Tile 4: Absent Today */}
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setMonitoringFilter('ABSENT');
              }}
              style={[
                styles.monitorTile,
                monitoringFilter === 'ABSENT' && styles.monitorTileActiveAmber,
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.monitorTileHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <UserX size={13} color="#F59E0B" />
                  <Text style={[styles.monitorTileTitle, { color: '#F59E0B' }]}>ABSENT</Text>
                </View>
                {monitoringFilter === 'ABSENT' && (
                  <View style={styles.activePillAmber}>
                    <Text style={styles.activePillAmberText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.monitorTileCount, { color: '#F59E0B' }]}>{absentCount}</Text>
              <Text style={styles.monitorTileSubtitle}>Active not checked in</Text>
              <Text numberOfLines={1} style={styles.monitorTilePreview}>
                {absentPreview.length > 0 ? absentPreview.join(', ') : 'Everyone present'}
              </Text>
            </TouchableOpacity>

            {/* Tile 5: Expired Memberships */}
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setMonitoringFilter('EXPIRED');
              }}
              style={[
                styles.monitorTile,
                monitoringFilter === 'EXPIRED' && styles.monitorTileActiveRed,
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.monitorTileHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={13} color="#EF4444" />
                  <Text style={[styles.monitorTileTitle, { color: '#EF4444' }]}>EXPIRED</Text>
                </View>
                {monitoringFilter === 'EXPIRED' && (
                  <View style={styles.activePillRed}>
                    <Text style={styles.activePillRedText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.monitorTileCount, { color: '#EF4444' }]}>{expiredCount}</Text>
              <Text style={styles.monitorTileSubtitle}>Expired memberships</Text>
              <Text numberOfLines={1} style={[styles.monitorTilePreview, { color: '#FCA5A5' }]}>
                {expiredPreview.length > 0 ? expiredPreview.join(', ') : 'No expired members'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Dedicated Tab Chip Row */}
          <View style={styles.rosterTabBarContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rosterTabBar}
            >
              {[
                { id: 'ALL' as const, label: 'All Members', count: totalCount, color: colors.gold },
                { id: 'ACTIVE' as const, label: 'Active', count: activeCount, color: '#00D4FF' },
                { id: 'PRESENT' as const, label: 'Present', count: presentCount, color: colors.success },
                { id: 'ABSENT' as const, label: 'Absent', count: absentCount, color: '#F59E0B' },
                { id: 'EXPIRED' as const, label: 'Expired', count: expiredCount, color: '#EF4444' },
              ].map(tab => {
                const isSelected = monitoringFilter === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => {
                      haptics.selection();
                      setMonitoringFilter(tab.id);
                    }}
                    style={[
                      styles.rosterTabChip,
                      isSelected && {
                        borderColor: tab.color,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.rosterTabDot, { backgroundColor: tab.color }]} />
                    <Text
                      style={[
                        styles.rosterTabChipText,
                        isSelected && { color: colors.textPrimary, fontWeight: '800' },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.rosterTabCountBadge,
                        isSelected && { backgroundColor: tab.color },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rosterTabCountText,
                          isSelected && { color: '#050505', fontWeight: '900' },
                        ]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Member Roster */}
          <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 }}>
            <FVEInput
              value={monitorSearch}
              onChangeText={setMonitorSearch}
              placeholder="Search athlete by name, ID, or mobile..."
              leftIcon={<Search size={16} color={colors.gold} />}
              rightIcon={monitorSearch ? <X size={16} color={colors.textSecondary} /> : undefined}
              onRightIconPress={() => setMonitorSearch('')}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          {/* Monitoring Member List */}
          {monitoringLoading ? (
            <FVELogoLoader message="Syncing Gym Roster..." fullScreen />
          ) : (
            <FlatList
              data={filteredMonitoring}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              refreshControl={
                <RefreshControl
                  refreshing={monitoringLoading}
                  onRefresh={onRefresh}
                  tintColor={colors.gold}
                  colors={[colors.gold]}
                />
              }
              renderItem={({ item }) => {
                const initial = item.full_name.charAt(0).toUpperCase();
                return (
                  <View style={styles.monitorCard}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        haptics.light();
                        setSelectedMemberForCalendar({
                          id: item.id,
                          full_name: item.full_name,
                          member_id: item.member_id,
                        });
                      }}
                      style={styles.monitorCardTop}
                    >
                      <TouchableOpacity
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={e => {
                          e?.stopPropagation?.();
                          haptics.light();
                          setPreviewPhotoMember({
                            profile_photo: item.profile_photo,
                            full_name: item.full_name,
                            member_id: item.member_id,
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`View profile photo of ${item.full_name}`}
                      >
                        {item.profile_photo ? (
                          <Image source={{ uri: item.profile_photo }} style={styles.monitorAvatar} />
                        ) : (
                          <View style={styles.monitorAvatarFallback}>
                            <Text style={styles.monitorAvatarText}>{initial}</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.monitorDetails}>
                        <View style={styles.monitorNameRow}>
                          <Text numberOfLines={1} style={styles.monitorName}>
                            {item.full_name}
                          </Text>
                          {item.member_id && (
                            <View style={styles.monitorIdBadge}>
                              <Text style={styles.monitorIdBadgeText}>{item.member_id}</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.monitorMeta}>
                          {item.plan_name || 'Standard'} {item.mobile ? `· ${item.mobile}` : ''}
                        </Text>
                      </View>

                      {/* Status Indicator */}
                      <View
                        style={
                          item.checkedInToday
                            ? styles.presentPill
                            : item.isExpired
                              ? styles.expiredPill
                              : !item.isActive
                                ? styles.inactivePill
                                : item.isContinuousAbsent
                                  ? styles.continuousAbsentPill
                                  : styles.absentPill
                        }
                      >
                        {item.checkedInToday ? (
                          <>
                            <CheckCircle size={11} color={colors.success} />
                            <Text style={styles.presentPillText}>PRESENT</Text>
                          </>
                        ) : item.isExpired ? (
                          <>
                            <AlertTriangle size={11} color="#EF4444" />
                            <Text style={styles.expiredPillText}>EXPIRED</Text>
                          </>
                        ) : !item.isActive ? (
                          <>
                            <AlertTriangle size={11} color="#F59E0B" />
                            <Text style={styles.inactivePillText}>
                              {item.membershipStatus === 'HOLD' ? 'ON HOLD' : item.membershipStatus === 'UPCOMING' ? 'UPCOMING' : 'INACTIVE'}
                            </Text>
                          </>
                        ) : item.isContinuousAbsent ? (
                          <>
                            <AlertTriangle size={11} color="#EF4444" />
                            <Text style={styles.continuousAbsentPillText}>
                              {item.consecutiveAbsentDays}D ABSENT
                            </Text>
                          </>
                        ) : (
                          <>
                            <UserX size={11} color="#F59E0B" />
                            <Text style={styles.absentPillText}>ABSENT</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Action Buttons Row */}
                    <View style={styles.monitorActionsRow}>
                      {!item.checkedInToday ? (
                        item.isActive ? (
                          <TouchableOpacity
                            onPress={() => handleManualCheckIn(item, todayStr)}
                            disabled={manualLoading}
                            style={styles.monitorCheckInBtn}
                            activeOpacity={0.85}
                          >
                            <UserCheck size={14} color="#050505" />
                            <Text style={styles.monitorCheckInBtnText}>Check In</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              haptics.warning();
                              sounds.qrInvalid();
                              Alert.alert(
                                'Attendance Restricted',
                                `Only active members are permitted to mark attendance.\n\n${item.full_name}'s membership is ${item.isExpired ? 'expired' : 'inactive'}. Please renew their subscription before checking in.`
                              );
                            }}
                            style={styles.monitorBlockedCheckInBtn}
                            activeOpacity={0.75}
                          >
                            <Ban size={13} color="#EF4444" />
                            <Text style={styles.monitorBlockedCheckInBtnText}>
                              {item.isExpired ? 'Expired' : 'Inactive'}
                            </Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <View style={styles.checkedInTimeBadge}>
                          <Clock size={12} color={colors.success} />
                          <Text style={styles.checkedInTimeText}>
                            Checked in at{' '}
                            {item.checkInTime
                              ? new Date(item.checkInTime).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                              : 'Today'}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={() => {
                          haptics.medium();
                          setFollowUpMember(item);
                        }}
                        style={styles.monitorFollowUpBtn}
                        activeOpacity={0.85}
                      >
                        <MessageCircle size={13} color="#FFFFFF" />
                        <Text style={styles.monitorFollowUpBtnText}>Follow Up</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          setSelectedMemberForCalendar({
                            id: item.id,
                            full_name: item.full_name,
                            member_id: item.member_id,
                          });
                        }}
                        style={styles.monitorCalendarBtn}
                        activeOpacity={0.8}
                      >
                        <Calendar size={13} color={colors.gold} />
                        <Text style={styles.monitorCalendarBtnText}>Calendar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          haptics.light();
                          setSelectedMemberForQR(item);
                        }}
                        style={styles.monitorQrBtn}
                        activeOpacity={0.8}
                      >
                        <QrCode size={14} color={colors.gold} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                !monitoringLoading ? (
                  <FVEEmptyState
                    icon={
                      monitoringFilter === 'ACTIVE' ? (
                        <UserCheck size={40} color="#00D4FF" />
                      ) : monitoringFilter === 'PRESENT' ? (
                        <CheckCircle size={40} color={colors.success} />
                      ) : monitoringFilter === 'EXPIRED' ? (
                        <AlertTriangle size={40} color="#EF4444" />
                      ) : (
                        <Users size={40} color={colors.gold} />
                      )
                    }
                    title={
                      monitorSearch.trim()
                        ? 'No Matching Athletes'
                        : monitoringFilter === 'ACTIVE'
                          ? 'No Active Members'
                          : monitoringFilter === 'PRESENT'
                            ? 'No Check-Ins Today'
                            : monitoringFilter === 'ABSENT'
                              ? 'All Active Members Present!'
                              : monitoringFilter === 'EXPIRED'
                                ? 'No Expired Members'
                                : 'No Members Found'
                    }
                    description={
                      monitorSearch.trim()
                        ? `No athletes found matching "${monitorSearch}".`
                        : monitoringFilter === 'ACTIVE'
                          ? 'There are currently no members with an active subscription.'
                          : monitoringFilter === 'PRESENT'
                            ? 'No members have checked in today yet. Use the camera scanner or check in active members above.'
                            : monitoringFilter === 'ABSENT'
                              ? 'Awesome! All active enrolled athletes have checked in today.'
                              : monitoringFilter === 'EXPIRED'
                                ? 'All enrolled athletes currently have valid subscriptions.'
                                : 'Add members from the Members tab to begin tracking gym attendance.'
                    }
                    actionTitle={monitoringFilter === 'PRESENT' ? 'Scan Member QR' : undefined}
                    onAction={monitoringFilter === 'PRESENT' ? () => navigation.navigate('QRScanner') : undefined}
                  />
                ) : null
              }
            />
          )}
        </View>
      )}

      {/* Manual Check-in Modal */}
      <FVEModal
        visible={showManualModal}
        onClose={() => { setShowManualModal(false); setManualSearch(''); }}
        title="MANUAL CHECK-IN"
        subtitle="Select an active gym member to register attendance"
      >
        {/* Active vs All filter buttons */}
        <View style={styles.manualFilterRow}>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setManualFilter('ACTIVE');
            }}
            style={[
              styles.manualFilterBtn,
              manualFilter === 'ACTIVE' && styles.manualFilterBtnActive,
            ]}
          >
            <UserCheck size={13} color={manualFilter === 'ACTIVE' ? '#050505' : colors.textSecondary} />
            <Text
              style={[
                styles.manualFilterBtnText,
                manualFilter === 'ACTIVE' && styles.manualFilterBtnTextActive,
              ]}
            >
              Active Only ({allMembers.filter(m => m.isActive).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setManualFilter('ALL');
            }}
            style={[
              styles.manualFilterBtn,
              manualFilter === 'ALL' && styles.manualFilterBtnActive,
            ]}
          >
            <Users size={13} color={manualFilter === 'ALL' ? '#050505' : colors.textSecondary} />
            <Text
              style={[
                styles.manualFilterBtnText,
                manualFilter === 'ALL' && styles.manualFilterBtnTextActive,
              ]}
            >
              All Members ({allMembers.length})
            </Text>
          </TouchableOpacity>
        </View>

        <FVEInput
          value={manualSearch}
          onChangeText={setManualSearch}
          placeholder="Search member by name, code, or phone..."
          leftIcon={<Search size={15} color={colors.gold} />}
          rightIcon={manualSearch ? <X size={14} color={colors.textSecondary} /> : undefined}
          onRightIconPress={() => setManualSearch('')}
          containerStyle={{ marginBottom: 12 }}
        />
        <ScrollView style={styles.manualList} showsVerticalScrollIndicator={false}>
          {allMembers
            .filter(m => {
              if (manualFilter === 'ACTIVE' && !m.isActive) return false;
              const term = manualSearch.trim().toLowerCase();
              if (!term) return true;
              return (
                m.full_name.toLowerCase().includes(term) ||
                (m.member_id || '').toLowerCase().includes(term) ||
                (m.mobile || '').includes(term)
              );
            })
            .map(m => (
              <TouchableOpacity
                key={m.id}
                onPress={() => {
                  if (!m.isActive) {
                    sounds.qrInvalid();
                    haptics.warning();
                    Alert.alert(
                      'Attendance Restricted',
                      `Only active members are permitted to mark attendance.\n\n${m.full_name}'s membership is ${m.isExpired ? 'expired' : 'inactive'}. Please renew their subscription before checking in.`
                    );
                    return;
                  }
                  handleManualCheckIn(m);
                }}
                disabled={manualLoading}
                style={[
                  styles.manualMemberItem,
                  !m.isActive && styles.manualMemberItemDisabled,
                ]}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.manualMemberName,
                        !m.isActive && { color: colors.textSecondary },
                      ]}
                    >
                      {m.full_name}
                    </Text>
                    {m.member_id && (
                      <Text style={styles.manualMemberId}>#{m.member_id}</Text>
                    )}
                  </View>
                  <Text style={styles.manualMemberPlan}>
                    {m.planName || 'Standard'} · {m.isActive ? 'Active' : m.isExpired ? 'Expired' : 'Inactive'}
                  </Text>
                </View>

                {m.isActive ? (
                  <View style={styles.manualActiveCheckBtn}>
                    <CheckCircle size={18} color={colors.gold} />
                  </View>
                ) : (
                  <View style={styles.manualBlockedBadge}>
                    <Ban size={12} color="#EF4444" />
                    <Text style={styles.manualBlockedBadgeText}>
                      {m.isExpired ? 'EXPIRED' : 'INACTIVE'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
        </ScrollView>
      </FVEModal>

      {/* Member QR Code Modal */}
      {selectedMemberForQR && (
        <FVEModal
          visible={!!selectedMemberForQR}
          onClose={() => setSelectedMemberForQR(null)}
          title="MEMBER CHECK-IN QR"
          subtitle={selectedMemberForQR.full_name}
        >
          <View style={styles.qrModalBody}>
            <View style={styles.qrModalCard}>
              <QRCode
                value={selectedMemberForQR.qr_code || selectedMemberForQR.id}
                size={180}
                color="#050505"
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.qrModalCodeText}>
              {selectedMemberForQR.qr_code || selectedMemberForQR.id}
            </Text>
            {selectedMemberForQR.member_id && (
              <View style={styles.qrModalIdBadge}>
                <Text style={styles.qrModalIdBadgeText}>ID: {selectedMemberForQR.member_id}</Text>
              </View>
            )}
            <Text style={styles.qrModalNote}>
              Scan at front-desk entrance kiosk · Valid once per day
            </Text>
            <TouchableOpacity
              onPress={async () => {
                haptics.medium();
                const code = selectedMemberForQR.qr_code || selectedMemberForQR.id;
                await Clipboard.setStringAsync(code);
                Alert.alert('Copied', 'QR code string copied to clipboard');
              }}
              style={styles.qrModalCopyBtn}
            >
              <Text style={styles.qrModalCopyBtnText}>Copy QR String</Text>
            </TouchableOpacity>
          </View>
        </FVEModal>
      )}

      {/* Interactive Monthly Attendance Calendar Modal */}
      {selectedMemberForCalendar && (
        <AttendanceCalendarModal
          visible={!!selectedMemberForCalendar}
          onClose={() => setSelectedMemberForCalendar(null)}
          member={selectedMemberForCalendar}
        />
      )}

      {/* Attendance Follow-up Modal */}
      <AttendanceFollowUpModal
        visible={Boolean(followUpMember)}
        onClose={() => setFollowUpMember(null)}
        member={followUpMember}
        attendanceInfo={
          followUpMember
            ? {
              checkedInToday: followUpMember.checkedInToday,
              consecutiveAbsentDays: followUpMember.consecutiveAbsentDays,
              lastCheckInDate: followUpMember.lastCheckInDate,
            }
            : null
        }
      />

      {/* Full-Size Profile Photo Modal */}
      <ProfilePhotoModal
        visible={!!previewPhotoMember}
        onClose={() => setPreviewPhotoMember(null)}
        photoUrl={previewPhotoMember?.profile_photo}
        memberName={previewPhotoMember?.full_name || 'Member'}
        memberId={previewPhotoMember?.member_id}
      />
    </View>
  );
}

const getAttendanceStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    exportHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.25)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    exportHeaderBtnText: {
      color: colors.gold,
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    modeSegmentBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDark,
      gap: 8,
    },
    modeSegmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    modeSegmentBtnActive: {
      backgroundColor: colors.gold,
      borderColor: colors.goldBright,
    },
    modeSegmentText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    modeSegmentTextActive: {
      color: '#050505',
      fontWeight: '800',
    },
    dateNavBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(217, 130, 0, 0.15)',
    },
    dateNavBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.1)' : 'rgba(217, 130, 0, 0.1)',
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
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
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
      borderBottomColor: colors.borderDark,
    },
    tabButtonsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    tabBtn: {
      flex: 1,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
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
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.18)' : 'rgba(217, 130, 0, 0.15)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.38)' : 'rgba(217, 130, 0, 0.35)',
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
      maxHeight: 350,
    },
    manualMemberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
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
    // Monitoring Styles
    monitorSummaryStrip: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderDark,
    },
    summaryBadgeBox: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : 'rgba(217, 130, 0, 0.25)',
      backgroundColor: colors.cardBackground,
    },
    summaryBadgeTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      marginBottom: 3,
    },
    summaryBadgeBoxPresent: {
      borderColor: isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(22, 163, 74, 0.35)',
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(22, 163, 74, 0.06)',
    },
    summaryBadgeBoxAbsent: {
      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(220, 38, 38, 0.35)',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(220, 38, 38, 0.06)',
    },
    summaryBadgeVal: {
      color: colors.textPrimary,
      fontSize: 16,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    summaryBadgeLabel: {
      color: colors.textSecondary,
      fontSize: 10.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    monitorCard: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    monitorCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    monitorAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.goldBorder,
    },
    monitorAvatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.goldBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monitorAvatarText: {
      color: colors.gold,
      fontSize: 18,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    monitorDetails: {
      flex: 1,
    },
    monitorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    monitorName: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      flexShrink: 1,
    },
    monitorIdBadge: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.3)' : 'rgba(217, 130, 0, 0.3)',
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    monitorIdBadgeText: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '700',
    },
    monitorMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
    presentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      borderWidth: 1,
      borderColor: '#22C55E',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    presentPillText: {
      color: '#16A34A',
      fontSize: 9.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    absentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderWidth: 1,
      borderColor: '#EF4444',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    absentPillText: {
      color: '#DC2626',
      fontSize: 9.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    monitorActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderDark,
    },
    monitorCheckInBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.gold,
      borderRadius: 10,
      paddingVertical: 8,
    },
    monitorCheckInBtnText: {
      color: '#050505',
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    checkedInTimeBadge: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(34, 197, 94, 0.08)',
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    checkedInTimeText: {
      color: colors.success,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      fontWeight: '600',
    },
    monitorCalendarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.1)' : 'rgba(217, 130, 0, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : 'rgba(217, 130, 0, 0.25)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    monitorCalendarBtnText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    monitorQrBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 10,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // QR Modal Styles
    qrModalBody: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    qrModalCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 2,
      borderColor: colors.goldBorder,
      marginBottom: 12,
    },
    qrModalCodeText: {
      color: colors.gold,
      fontSize: 12,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    qrModalIdBadge: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 2,
      marginBottom: 8,
    },
    qrModalIdBadgeText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
    },
    qrModalNote: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      textAlign: 'center',
      marginBottom: 16,
    },
    qrModalCopyBtn: {
      width: '100%',
      backgroundColor: colors.gold,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    qrModalCopyBtnText: {
      color: '#050505',
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    monitorTilesContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      gap: 10,
    },
    monitorTile: {
      width: 155,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 14,
      padding: 12,
      paddingBottom: 30,
      justifyContent: 'space-between',
    },
    monitorTileActiveGold: {
      borderColor: colors.gold,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
    },
    monitorTileActiveBlue: {
      borderColor: '#00D4FF',
      backgroundColor: isDark ? 'rgba(0, 212, 255, 0.12)' : 'rgba(0, 150, 255, 0.12)',
    },
    monitorTileActiveGreen: {
      borderColor: colors.success,
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
    },
    monitorTileActiveAmber: {
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    monitorTileActiveRed: {
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    monitorTileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    monitorTileTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 11,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    activePillGold: {
      backgroundColor: colors.gold,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    activePillGoldText: {
      color: '#050505',
      fontSize: 9,
      fontWeight: '800',
      fontFamily: typography.fonts.rajdhani,
    },
    activePillBlue: {
      backgroundColor: '#00D4FF',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    activePillBlueText: {
      color: '#050505',
      fontSize: 9,
      fontWeight: '800',
      fontFamily: typography.fonts.rajdhani,
    },
    activePillGreen: {
      backgroundColor: colors.success,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    activePillGreenText: {
      color: '#050505',
      fontSize: 9,
      fontWeight: '800',
      fontFamily: typography.fonts.rajdhani,
    },
    activePillAmber: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    activePillAmberText: {
      color: '#050505',
      fontSize: 9,
      fontWeight: '800',
      fontFamily: typography.fonts.rajdhani,
    },
    activePillRed: {
      backgroundColor: '#EF4444',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    activePillRedText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
      fontFamily: typography.fonts.rajdhani,
    },
    badge3D: {
      backgroundColor: 'rgba(239, 68, 68, 0.25)',
      borderWidth: 1,
      borderColor: '#EF4444',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    badge3DText: {
      color: '#EF4444',
      fontSize: 9,
      fontWeight: '800',
      fontFamily: typography.fonts.rajdhani,
    },
    monitorTileCount: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 26,
      fontWeight: '800',
      color: colors.gold,
    },
    monitorTileSubtitle: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: typography.fonts.inter,
      marginTop: 1,
    },
    monitorTilePreview: {
      fontSize: 10,
      color: colors.textSecondary,
      fontFamily: typography.fonts.inter,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderDark,
    },
    rosterTabBarContainer: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    rosterTabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rosterTabChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    rosterTabDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    rosterTabChipText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    rosterTabCountBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    },
    rosterTabCountText: {
      color: colors.textPrimary,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    expiredPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderWidth: 1,
      borderColor: '#EF4444',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    expiredPillText: {
      color: '#EF4444',
      fontSize: 9.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    inactivePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderWidth: 1,
      borderColor: '#F59E0B',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    inactivePillText: {
      color: '#F59E0B',
      fontSize: 9.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    monitorBlockedCheckInBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
      borderRadius: 10,
      paddingVertical: 8,
    },
    monitorBlockedCheckInBtnText: {
      color: '#EF4444',
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    monitorFollowUpBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: '#25D366',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    monitorFollowUpBtnText: {
      color: '#FFFFFF',
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    continuousAbsentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.18)',
      borderWidth: 1,
      borderColor: '#EF4444',
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    continuousAbsentPillText: {
      color: '#EF4444',
      fontSize: 9.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    manualFilterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    manualFilterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    manualFilterBtnActive: {
      backgroundColor: colors.gold,
      borderColor: colors.goldBright,
    },
    manualFilterBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    manualFilterBtnTextActive: {
      color: '#050505',
      fontWeight: '800',
    },
    manualMemberItemDisabled: {
      opacity: 0.6,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
    },
    manualMemberPlan: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
    manualActiveCheckBtn: {
      padding: 4,
    },
    manualBlockedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)',
    },
    manualBlockedBadgeText: {
      color: '#EF4444',
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
