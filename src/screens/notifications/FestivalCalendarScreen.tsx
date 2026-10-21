import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Star,
  Info,
  MessageCircle,
  Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVEModal } from '@/components/common/FVEModal';
import { WhatsAppQueueModal, ExpiringQueueItem } from '@/components/features/WhatsAppQueueModal';
import { FestivalEvent, FestivalEventType, FESTIVAL_EVENT_TYPES } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBranding } from '@/contexts/BrandingContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<FestivalEventType, string> = {
  FESTIVAL:      '#EFA100',
  HOLIDAY:       '#0066FF',
  GYM_EVENT:     '#22C55E',
  CLOSURE:       '#EF4444',
  SPECIAL_OFFER: '#A855F7',
  OTHER:         '#6B7280',
};

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

const QUICK_EMOJIS = ['🎉', '🪔', '🎄', '🌙', '🎆', '🏹', '🎨', '🪁', '⭐', '🎊'];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ─── EventFormModal ──────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  event_date: string;
  event_type: FestivalEventType;
  emoji: string;
  is_recurring: boolean;
}

function defaultForm(event?: FestivalEvent | null): FormState {
  if (event) {
    return {
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      event_type: event.event_type,
      emoji: event.emoji || '🎉',
      is_recurring: event.is_recurring,
    };
  }
  const today = new Date();
  return {
    title: '',
    description: '',
    event_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    event_type: 'FESTIVAL',
    emoji: '🎉',
    is_recurring: true,
  };
}

interface EventFormModalProps {
  visible: boolean;
  event: FestivalEvent | null;
  canManage: boolean;
  colors: ThemeColors;
  isDark: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EventFormModal({
  visible,
  event,
  canManage,
  colors,
  isDark,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(() => defaultForm(event));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Re-initialize form when the target event changes
  React.useEffect(() => {
    setForm(defaultForm(event));
    setErrors({});
  }, [event, visible]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 2) errs.title = 'Title must be at least 2 characters';
    if (!form.event_date) errs.event_date = 'Date is required (YYYY-MM-DD)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { haptics.warning(); return; }
    setSaving(true);
    haptics.medium();
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
        event_type: form.event_type,
        emoji: form.emoji || null,
        color_tag: EVENT_TYPE_COLORS[form.event_type] || '#EFA100',
        is_recurring: form.is_recurring,
        recurrence_year: form.is_recurring ? null : new Date(form.event_date).getFullYear(),
      };

      if (event) {
        const { error } = await supabase.from('festival_events').update(payload).eq('id', event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('festival_events').insert({ ...payload, created_by: user?.id || null });
        if (error) throw error;
      }

      haptics.success();
      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.warning();
      Alert.alert('Error', (err as Error).message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const sheetBg = colors.surface;
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const borderColor = colors.borderDark;
  const footer = canManage ? (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TouchableOpacity
        onPress={onClose}
        style={[formStyles.btn, { flex: 1, borderColor: borderColor, backgroundColor: 'transparent', marginTop: 0 }]}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={[formStyles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={[formStyles.btn, { flex: 2, backgroundColor: colors.gold, borderColor: colors.gold, opacity: saving ? 0.6 : 1, marginTop: 0 }]}
        accessibilityRole="button"
        accessibilityLabel={event ? 'Update event' : 'Create event'}
      >
        <Text style={[formStyles.btnText, { color: '#050505', fontFamily: typography.fonts.rajdhani, fontWeight: '700' }]}>
          {saving ? 'Saving…' : event ? 'Update Event' : 'Create Event'}
        </Text>
      </TouchableOpacity>
    </View>
  ) : undefined;

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={event ? 'Edit Festival Event' : 'Add Festival Event'}
      subtitle="Gym-wide shared festival event"
      footer={footer}
    >
      {/* Title */}
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>EVENT TITLE *</Text>
      <TextInput
        value={form.title}
        onChangeText={v => setForm(f => ({ ...f, title: v }))}
        placeholder="e.g. Diwali Celebrations"
        placeholderTextColor={colors.textMuted}
        editable={canManage}
        style={[
          formStyles.input,
          { backgroundColor: inputBg, borderColor: errors.title ? colors.error : borderColor, color: colors.textPrimary },
        ]}
        accessibilityLabel="Event title"
      />
      {errors.title ? <Text style={[formStyles.errorText, { color: colors.error }]}>{errors.title}</Text> : null}

      {/* Date */}
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>EVENT DATE * (YYYY-MM-DD)</Text>
      <TextInput
        value={form.event_date}
        onChangeText={v => setForm(f => ({ ...f, event_date: v }))}
        placeholder="2026-10-20"
        placeholderTextColor={colors.textMuted}
        editable={canManage}
        keyboardType="numbers-and-punctuation"
        style={[
          formStyles.input,
          { backgroundColor: inputBg, borderColor: errors.event_date ? colors.error : borderColor, color: colors.textPrimary },
        ]}
        accessibilityLabel="Event date"
      />
      {errors.event_date ? <Text style={[formStyles.errorText, { color: colors.error }]}>{errors.event_date}</Text> : null}

      {/* Event Type */}
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FESTIVAL_EVENT_TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              onPress={() => setForm(f => ({ ...f, event_type: t.value }))}
              disabled={!canManage}
              style={[
                formStyles.typePill,
                {
                  backgroundColor: form.event_type === t.value
                    ? `${EVENT_TYPE_COLORS[t.value]}22`
                    : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: form.event_type === t.value
                    ? EVENT_TYPE_COLORS[t.value]
                    : borderColor,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: form.event_type === t.value }}
            >
              <Text style={[formStyles.typePillText, { color: form.event_type === t.value ? EVENT_TYPE_COLORS[t.value] : colors.textSecondary }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Description */}
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
      <TextInput
        value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        placeholder="Notes about this event…"
        placeholderTextColor={colors.textMuted}
        editable={canManage}
        multiline
        numberOfLines={3}
        style={[
          formStyles.input,
          formStyles.textArea,
          { backgroundColor: inputBg, borderColor: borderColor, color: colors.textPrimary },
        ]}
        accessibilityLabel="Event description"
      />

      {/* Emoji */}
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>EMOJI</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {QUICK_EMOJIS.map(em => (
            <TouchableOpacity
              key={em}
              onPress={() => setForm(f => ({ ...f, emoji: em }))}
              disabled={!canManage}
              style={[
                formStyles.emojiBtn,
                {
                  backgroundColor: form.emoji === em
                    ? isDark ? 'rgba(239,161,0,0.18)' : 'rgba(217,130,0,0.12)'
                    : inputBg,
                  borderColor: form.emoji === em ? colors.goldBorder : borderColor,
                },
              ]}
              accessibilityLabel={`Select emoji ${em}`}
            >
              <Text style={formStyles.emojiText}>{em}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Recurring */}
      <View style={[formStyles.recurringRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: borderColor }]}>
        <View style={{ flex: 1 }}>
          <Text style={[formStyles.recurringTitle, { color: colors.textPrimary }]}>Recurring Annually</Text>
          <Text style={[formStyles.recurringSubtitle, { color: colors.textMuted }]}>Repeat every year (e.g. Diwali)</Text>
        </View>
        <Switch
          value={form.is_recurring}
          onValueChange={v => setForm(f => ({ ...f, is_recurring: v }))}
          disabled={!canManage}
          trackColor={{ false: colors.borderDark, true: colors.goldMuted }}
          thumbColor={form.is_recurring ? colors.gold : colors.textMuted}
          ios_backgroundColor={colors.borderDark}
          accessibilityLabel="Toggle recurring annually"
        />
      </View>
    </FVEModal>
  );
}

// ─── FestivalGreetingModal ───────────────────────────────────────────────────

interface ActiveMemberRecord {
  membershipId: string;
  memberId: string;
  fullName: string;
  mobile: string;
  planName: string;
  expiryDate: string;
}

interface FestivalGreetingModalProps {
  visible: boolean;
  event: FestivalEvent | null;
  colors: ThemeColors;
  isDark: boolean;
  gymName: string;
  onClose: () => void;
  onLaunchQueue: (queue: ExpiringQueueItem[]) => void;
}

function FestivalGreetingModal({
  visible,
  event,
  colors,
  isDark,
  gymName,
  onClose,
  onLaunchQueue,
}: FestivalGreetingModalProps) {
  const [activeMembers, setActiveMembers] = useState<ActiveMemberRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState('');

  const defaultTemplate = useMemo(() => {
    if (!event) return '';
    const cleanEmoji = event.emoji || '🎉';
    const note = event.description?.trim()
      ? `\n\n📌 *Special Announcement:* ${event.description.trim()}`
      : '';

    return (
      `Hi *{memberName}*,\n\n` +
      `${cleanEmoji} *Happy ${event.title}!* ${cleanEmoji}\n\n` +
      `Wishing you and your family immense strength, health, happiness, and prosperity from all of us at *{gymName}*! 💪✨` +
      note +
      `\n\n— Team {gymName}`
    );
  }, [event]);

  React.useEffect(() => {
    if (!visible || !event) {
      setActiveMembers([]);
      setTemplate('');
      return;
    }

    setTemplate(defaultTemplate);

    let isMounted = true;
    async function fetchActive() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('memberships')
          .select(`
            id,
            member_id,
            status,
            expiry_date,
            members:member_id (
              id,
              member_id,
              full_name,
              mobile
            ),
            membership_plans:plan_id (
              name
            )
          `)
          .in('status', ['ACTIVE', 'EXPIRING_SOON']);

        if (error) throw error;
        if (!isMounted) return;

        const map = new Map<string, ActiveMemberRecord>();
        for (const row of (data || []) as any[]) {
          const mem = row.members;
          if (!mem || !mem.mobile || !mem.mobile.trim()) continue;
          if (!map.has(mem.id)) {
            map.set(mem.id, {
              membershipId: row.id,
              memberId: mem.member_id || mem.id,
              fullName: mem.full_name || 'Member',
              mobile: mem.mobile.trim(),
              planName: row.membership_plans?.name || 'Active Member',
              expiryDate: row.expiry_date || '',
            });
          }
        }
        setActiveMembers(Array.from(map.values()));
      } catch (err: any) {
        if (isMounted) {
          Alert.alert('Error', `Failed to load active members: ${err.message}`);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchActive();

    return () => {
      isMounted = false;
    };
  }, [visible, event, defaultTemplate]);

  if (!visible || !event) return null;

  const sampleMember = activeMembers[0]?.fullName || 'Rahul Sharma';
  const previewMessage = template
    .replace(/{memberName}/g, sampleMember)
    .replace(/{gymName}/g, gymName || 'FitVerse Elite');

  const handleStartQueue = () => {
    if (activeMembers.length === 0) {
      haptics.warning();
      Alert.alert('No Members', 'No active members with recorded mobile phone numbers were found.');
      return;
    }

    haptics.success();
    const effectiveGymName = gymName || 'FitVerse Elite';
    const queue: ExpiringQueueItem[] = activeMembers.map((m) => {
      const msg = template
        .replace(/{memberName}/g, m.fullName)
        .replace(/{gymName}/g, effectiveGymName);

      return {
        id: m.membershipId || m.memberId,
        memberId: m.memberId,
        memberName: m.fullName,
        memberMobile: m.mobile,
        planName: m.planName,
        expiryDate: m.expiryDate,
        daysLeft: 0,
        message: msg,
      };
    });

    onLaunchQueue(queue);
  };

  const footer = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TouchableOpacity
        onPress={onClose}
        style={[formStyles.btn, { flex: 1, borderColor: colors.borderDark, backgroundColor: 'transparent', marginTop: 0 }]}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={[formStyles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleStartQueue}
        disabled={loading || activeMembers.length === 0}
        style={[
          formStyles.btn,
          {
            flex: 2,
            backgroundColor: '#10B981',
            borderColor: '#10B981',
            opacity: loading || activeMembers.length === 0 ? 0.5 : 1,
            marginTop: 0,
            flexDirection: 'row',
            gap: 6,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Start WhatsApp Queue"
      >
        <MessageCircle size={15} color="#FFFFFF" />
        <Text style={[formStyles.btnText, { color: '#FFFFFF', fontWeight: '700' }]}>
          {loading ? 'Loading…' : `Start Queue (${activeMembers.length})`}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="Send Festival Greeting"
      subtitle={`${event.title} • WhatsApp Broadcast`}
      footer={footer}
    >
      {/* Target Audience Summary */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderRadius: 12,
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={16} color="#10B981" />
          </View>
          <View>
            <Text style={{ fontSize: 10, fontFamily: typography.fonts.rajdhani, fontWeight: '700', color: '#10B981', letterSpacing: 0.5 }}>
              TARGET AUDIENCE
            </Text>
            <Text style={{ fontSize: 13, fontFamily: typography.fonts.inter, fontWeight: '700', color: colors.textPrimary }}>
              {loading ? 'Finding active members…' : `${activeMembers.length} Active Members`}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 10, fontFamily: typography.fonts.inter, color: colors.textMuted }}>
          Valid mobile only
        </Text>
      </View>

      {/* Template Editor */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 6 }}>
        <Text style={[formStyles.label, { color: colors.textSecondary, marginBottom: 0, marginTop: 0 }]}>
          CUSTOMIZE GREETING MESSAGE
        </Text>
        <TouchableOpacity onPress={() => setTemplate(defaultTemplate)}>
          <Text style={{ fontSize: 11, fontFamily: typography.fonts.inter, color: colors.gold }}>Reset</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        value={template}
        onChangeText={setTemplate}
        multiline
        numberOfLines={6}
        style={[
          formStyles.input,
          formStyles.textArea,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: colors.borderDark,
            color: colors.textPrimary,
            minHeight: 110,
            fontSize: 12,
            lineHeight: 18,
          },
        ]}
        accessibilityLabel="Greeting message template"
      />

      {/* Insert Tag Pills */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 14 }}>
        <Text style={{ fontSize: 10, fontFamily: typography.fonts.inter, color: colors.textMuted }}>Insert tag:</Text>
        <TouchableOpacity
          onPress={() => setTemplate((t) => t + ' {memberName}')}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.borderDark,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          }}
        >
          <Text style={{ fontSize: 10, fontFamily: typography.fonts.inter, color: colors.textSecondary }}>+ &#123;memberName&#125;</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTemplate((t) => t + ' {gymName}')}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.borderDark,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          }}
        >
          <Text style={{ fontSize: 10, fontFamily: typography.fonts.inter, color: colors.textSecondary }}>+ &#123;gymName&#125;</Text>
        </TouchableOpacity>
      </View>

      {/* Member WhatsApp Preview */}
      <Text style={[formStyles.label, { color: colors.textSecondary, marginTop: 4, marginBottom: 6 }]}>
        MEMBER WHATSAPP PREVIEW (EXAMPLE: {sampleMember})
      </Text>
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: isDark ? '#0B141A' : '#E8F5E9',
          borderWidth: 1,
          borderColor: isDark ? '#202C33' : '#C8E6C9',
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 11, fontFamily: typography.fonts.inter, color: isDark ? '#E9EDEF' : '#1B5E20', lineHeight: 17 }}>
          {previewMessage}
        </Text>
      </View>

      {/* Advisory */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          padding: 10,
          borderRadius: 10,
          backgroundColor: isDark ? 'rgba(239, 161, 0, 0.08)' : 'rgba(217, 130, 0, 0.08)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(239, 161, 0, 0.2)' : 'rgba(217, 130, 0, 0.2)',
          marginBottom: 16,
        }}
      >
        <Info size={14} color={colors.gold} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontSize: 10, fontFamily: typography.fonts.inter, color: colors.textSecondary, lineHeight: 15 }}>
          Messages launch in the <Text style={{ fontWeight: '700', color: colors.gold }}>WhatsApp Fast-Queue</Text> with 1 tap per member. This ensures personalized delivery without risk of bulk spam flags.
        </Text>
      </View>
    </FVEModal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function FestivalCalendarScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const { brandConfig } = useBranding();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const canManage = ['OWNER', 'ADMIN'].includes(user?.role || '');

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FestivalEvent | null>(null);
  const [greetingEvent, setGreetingEvent] = useState<FestivalEvent | null>(null);
  const [whatsAppQueue, setWhatsAppQueue] = useState<ExpiringQueueItem[]>([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [filterType, setFilterType] = useState<FestivalEventType | 'ALL'>('ALL');

  const { data: events = [], isLoading, refetch } = useQuery<FestivalEvent[]>({
    queryKey: ['festival-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_events')
        .select('*')
        .order('event_date', { ascending: true });
      if (error) throw error;
      return (data || []) as FestivalEvent[];
    },
    refetchInterval: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('festival_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      qc.invalidateQueries({ queryKey: ['festival-events'] });
    },
    onError: (err: Error) => {
      haptics.warning();
      Alert.alert('Error', err.message);
    },
  });

  const handleDelete = (event: FestivalEvent) => {
    haptics.warning();
    Alert.alert(
      'Delete Event',
      `Remove "${event.title}" from the festival calendar?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(event.id) },
      ]
    );
  };

  // Calendar helpers
  const daysCount = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, FestivalEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.event_date + 'T00:00:00');
      const matchYear = ev.is_recurring || d.getFullYear() === viewYear;
      if (!matchYear) continue;
      if (d.getMonth() !== viewMonth) continue;
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events, viewMonth, viewYear]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter(ev => {
        const d = new Date(ev.event_date + 'T00:00:00');
        const thisYearDate = `${viewYear}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const effectiveDate = ev.is_recurring ? thisYearDate : ev.event_date;
        if (effectiveDate < todayStr) return false;
        if (filterType !== 'ALL' && ev.event_type !== filterType) return false;
        return true;
      })
      .slice(0, 30);
  }, [events, filterType, todayStr, viewYear]);

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  const prevMonth = useCallback(() => {
    haptics.selection();
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    haptics.selection();
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  }, [viewMonth]);

  const handleDayPress = useCallback((day: number) => {
    haptics.light();
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  }, [viewYear, viewMonth]);

  const onRefresh = useCallback(() => {
    haptics.light();
    refetch();
  }, [refetch]);

  const calendarCells = useMemo(() => {
    const cells: Array<number | null> = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysCount; d++) cells.push(d);
    return cells;
  }, [startDay, daysCount]);

  const CELL_W = Math.floor(100 / 7); // percent isn't the best for RN; use fixed sizing via flex

  return (
    <View style={styles.container}>
      <FVEHeader
        title="FESTIVAL CALENDAR"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          canManage ? (
            <TouchableOpacity
              onPress={() => { haptics.medium(); setEditingEvent(null); setShowForm(true); }}
              style={styles.addBtn}
              accessibilityRole="button"
              accessibilityLabel="Add festival event"
            >
              <Plus size={14} color={colors.gold} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => { haptics.light(); refetch(); }}
              style={styles.refreshBtn}
              accessibilityRole="button"
              accessibilityLabel="Refresh calendar"
            >
              <RefreshCw size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )
        }
      />

      <FlatList
        data={upcomingEvents}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <>
            {/* ── Month Navigator ── */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn} accessibilityLabel="Previous month" accessibilityRole="button">
                <ChevronLeft size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
                {getMonthLabel(viewYear, viewMonth).toUpperCase()}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn} accessibilityLabel="Next month" accessibilityRole="button">
                <ChevronRight size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* ── Weekday Headers ── */}
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((wd, i) => (
                <Text key={i} style={[styles.weekdayLabel, { color: colors.textMuted }]}>{wd}</Text>
              ))}
            </View>

            {/* ── Calendar Grid ── */}
            <View style={styles.calGrid}>
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.calCell} />;
                }
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = eventsByDate.get(dateKey) || [];
                const isToday = dateKey === todayStr;
                const isSelected = dateKey === selectedDate;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    onPress={() => handleDayPress(day)}
                    style={[
                      styles.calCell,
                      isSelected && { backgroundColor: isDark ? 'rgba(239,161,0,0.16)' : 'rgba(217,130,0,0.12)', borderColor: colors.goldBorder },
                    ]}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${getMonthLabel(viewYear, viewMonth)}, ${dayEvents.length} events`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[
                      styles.calDayCircle,
                      isToday && { backgroundColor: colors.gold },
                    ]}>
                      <Text style={[
                        styles.calDayText,
                        { color: isToday ? '#050505' : colors.textPrimary },
                        isToday && { fontWeight: '800' },
                      ]}>{day}</Text>
                    </View>
                    {/* Dot indicators */}
                    <View style={styles.calDots}>
                      {dayEvents.slice(0, 3).map(ev => (
                        <View
                          key={ev.id}
                          style={[
                            styles.calDot,
                            { backgroundColor: ev.color_tag || EVENT_TYPE_COLORS[ev.event_type] || colors.gold },
                          ]}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Selected Date Events ── */}
            {selectedDate && (
              <View style={[styles.selectedSection, { borderColor: colors.goldBorder }]}>
                <View style={styles.selectedHeader}>
                  <CalendarDays size={13} color={colors.gold} />
                  <Text style={[styles.selectedDateLabel, { color: colors.gold }]}>
                    {formatEventDate(selectedDate)}
                  </Text>
                </View>
                {selectedEvents.length === 0 ? (
                  <Text style={[styles.noEventsText, { color: colors.textMuted }]}>No events on this day</Text>
                ) : (
                  selectedEvents.map(ev => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      canManage={canManage}
                      colors={colors}
                      isDark={isDark}
                      onEdit={() => { setEditingEvent(ev); setShowForm(true); }}
                      onDelete={() => handleDelete(ev)}
                      onSendGreeting={() => { haptics.light(); setGreetingEvent(ev); }}
                    />
                  ))
                )}
              </View>
            )}

            {/* ── Upcoming Events Header ── */}
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Star size={13} color={colors.gold} />
                <Text style={[styles.upcomingTitle, { color: colors.textPrimary }]}>Upcoming Events</Text>
              </View>
            </View>

            {/* ── Type Filter ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { haptics.selection(); setFilterType('ALL'); }}
                  style={[styles.filterPill, filterType === 'ALL' && { backgroundColor: isDark ? 'rgba(239,161,0,0.16)' : 'rgba(217,130,0,0.12)', borderColor: colors.goldBorder }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filterType === 'ALL' }}
                  accessibilityLabel="Show all event types"
                >
                  <Text style={[styles.filterPillText, { color: filterType === 'ALL' ? colors.gold : colors.textSecondary }]}>All</Text>
                </TouchableOpacity>
                {FESTIVAL_EVENT_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => { haptics.selection(); setFilterType(t.value); }}
                    style={[
                      styles.filterPill,
                      filterType === t.value && {
                        backgroundColor: `${EVENT_TYPE_COLORS[t.value]}22`,
                        borderColor: EVENT_TYPE_COLORS[t.value],
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filterType === t.value }}
                    accessibilityLabel={`Filter by ${t.label}`}
                  >
                    <Text style={[styles.filterPillText, { color: filterType === t.value ? EVENT_TYPE_COLORS[t.value] : colors.textSecondary }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <EventRow
            event={item}
            canManage={canManage}
            colors={colors}
            isDark={isDark}
            onEdit={() => { haptics.light(); setEditingEvent(item); setShowForm(true); }}
            onDelete={() => handleDelete(item)}
            onSendGreeting={() => { haptics.light(); setGreetingEvent(item); }}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<Info size={36} color={colors.gold} />}
              title="No Upcoming Events"
              description="Festival events and gym announcements will appear here."
            />
          ) : null
        }
      />

      {/* ── Event Form Modal ── */}
      <EventFormModal
        visible={showForm}
        event={editingEvent}
        canManage={canManage}
        colors={colors}
        isDark={isDark}
        onClose={() => { setShowForm(false); setEditingEvent(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ['festival-events'] })}
      />

      {/* ── Festival Greeting Modal ── */}
      <FestivalGreetingModal
        visible={greetingEvent !== null}
        event={greetingEvent}
        colors={colors}
        isDark={isDark}
        gymName={brandConfig.gym_name || 'FitVerse Elite'}
        onClose={() => setGreetingEvent(null)}
        onLaunchQueue={(queue) => {
          setGreetingEvent(null);
          setWhatsAppQueue(queue);
          setShowQueueModal(true);
        }}
      />

      {/* ── WhatsApp Fast-Queue Broadcast Modal ── */}
      <WhatsAppQueueModal
        visible={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        queue={whatsAppQueue}
      />
    </View>
  );
}

// ─── EventRow ────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: FestivalEvent;
  canManage: boolean;
  colors: ThemeColors;
  isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSendGreeting?: () => void;
}

function EventRow({ event, canManage, colors, isDark, onEdit, onDelete, onSendGreeting }: EventRowProps) {
  const typeColor = EVENT_TYPE_COLORS[event.event_type] || colors.gold;
  const typeMeta = FESTIVAL_EVENT_TYPES.find(t => t.value === event.event_type);

  return (
    <View style={[rowStyles.row, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.borderLight, backgroundColor: colors.surface }]}>
      {/* Emoji badge */}
      <View style={[rowStyles.emojiBox, { backgroundColor: `${typeColor}22` }]}>
        <Text style={rowStyles.emojiText}>{event.emoji || '🎉'}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <Text style={[rowStyles.date, { color: colors.textMuted }]}>{formatEventDate(event.event_date)}</Text>
          <View style={[rowStyles.typeBadge, { backgroundColor: `${typeColor}18`, borderColor: `${typeColor}44` }]}>
            <Text style={[rowStyles.typeBadgeText, { color: typeColor }]}>{typeMeta?.label || event.event_type}</Text>
          </View>
          {event.is_recurring && <Text style={[rowStyles.recurringTag, { color: colors.textMuted }]}>↻ Yearly</Text>}
        </View>
        {event.description ? (
          <Text style={[rowStyles.description, { color: colors.textSecondary }]} numberOfLines={2}>{event.description}</Text>
        ) : null}
      </View>

      {canManage && (
        <View style={{ gap: 6, alignItems: 'center' }}>
          {onSendGreeting && (
            <TouchableOpacity
              onPress={onSendGreeting}
              style={[rowStyles.iconBtn, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)' }]}
              accessibilityRole="button"
              accessibilityLabel={`Send greeting for ${event.title}`}
            >
              <MessageCircle size={14} color="#10B981" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onEdit}
            style={[rowStyles.iconBtn, { backgroundColor: isDark ? 'rgba(239,161,0,0.12)' : 'rgba(217,130,0,0.1)' }]}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${event.title}`}
          >
            <Pencil size={13} color={colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={[rowStyles.iconBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' }]}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${event.title}`}
          >
            <Trash2 size={13} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingTop: 0 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: isDark ? 'rgba(239,161,0,0.16)' : 'rgba(217,130,0,0.12)',
      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 1, borderColor: isDark ? 'rgba(239,161,0,0.3)' : 'rgba(217,130,0,0.25)',
    },
    addBtnText: {
      color: colors.gold, fontSize: 11,
      fontFamily: typography.fonts.rajdhani, fontWeight: '700',
    },
    refreshBtn: { padding: 6 },
    // Month Nav
    monthNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDark,
    },
    monthNavBtn: { padding: 6 },
    monthLabel: {
      fontFamily: typography.fonts.orbitron, fontSize: 13, fontWeight: '700', letterSpacing: 1.2,
    },
    // Weekday headers
    weekdayRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6 },
    weekdayLabel: {
      flex: 1, textAlign: 'center', fontSize: 11,
      fontFamily: typography.fonts.rajdhani, fontWeight: '700', letterSpacing: 0.5,
    },
    // Calendar grid
    calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginBottom: 8 },
    calCell: {
      width: '14.28%', aspectRatio: 0.85, alignItems: 'center', paddingTop: 4,
      borderRadius: 8, borderWidth: 1, borderColor: 'transparent',
    },
    calDayCircle: {
      width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    },
    calDayText: {
      fontSize: 12, fontFamily: typography.fonts.inter, fontWeight: '600',
    },
    calDots: { flexDirection: 'row', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' },
    calDot: { width: 4, height: 4, borderRadius: 2 },
    // Selected date section
    selectedSection: {
      marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1,
      padding: 12, backgroundColor: isDark ? 'rgba(239,161,0,0.06)' : 'rgba(217,130,0,0.05)',
    },
    selectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    selectedDateLabel: {
      fontSize: 12, fontFamily: typography.fonts.rajdhani, fontWeight: '700', letterSpacing: 0.4,
    },
    noEventsText: { fontSize: 13, fontFamily: typography.fonts.inter, paddingVertical: 4 },
    // Upcoming section
    upcomingHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDark,
    },
    upcomingTitle: {
      fontSize: 13, fontFamily: typography.fonts.rajdhani, fontWeight: '700', letterSpacing: 0.5,
    },
    // Filter pills
    filterPill: {
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
      borderWidth: 1, borderColor: colors.borderDark,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    filterPillText: {
      fontSize: 11, fontFamily: typography.fonts.inter, fontWeight: '600',
    },
  });

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emojiBox: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 20 },
  title: {
    fontSize: 13, fontFamily: typography.fonts.rajdhani, fontWeight: '700', letterSpacing: 0.3,
  },
  date: { fontSize: 11, fontFamily: typography.fonts.inter },
  typeBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 10, fontFamily: typography.fonts.inter, fontWeight: '600' },
  recurringTag: { fontSize: 10, fontFamily: typography.fonts.inter },
  description: { fontSize: 11, fontFamily: typography.fonts.inter, marginTop: 3, lineHeight: 16 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

const formStyles = StyleSheet.create({
  label: {
    fontSize: 10, fontFamily: typography.fonts.rajdhani, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 14,
  },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: typography.fonts.inter,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontSize: 11, fontFamily: typography.fonts.inter, marginTop: 4 },
  typePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  typePillText: { fontSize: 12, fontFamily: typography.fonts.inter, fontWeight: '600' },
  emojiBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 20 },
  recurringRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12,
    borderWidth: 1, padding: 12, marginTop: 16,
  },
  recurringTitle: {
    fontSize: 13, fontFamily: typography.fonts.rajdhani, fontWeight: '700',
  },
  recurringSubtitle: {
    fontSize: 11, fontFamily: typography.fonts.inter, marginTop: 2,
  },
  btn: {
    paddingVertical: 13, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  btnText: {
    fontSize: 14, fontFamily: typography.fonts.rajdhani, fontWeight: '700', letterSpacing: 0.4,
  },
});
