import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Cake,
  MessageCircle,
  CalendarDays,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { Notification } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { formatDateTime, formatDate, getLocalDateStr } from '@/utils/date';
import { buildBirthdayWishMessage, openWhatsAppLink } from '@/utils/format';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 40;

function cleanTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
}

function cleanMessage(message?: string | null): string {
  if (!message) return '';
  return message
    .replace(/\(\s*0\s*days?\s*left\s*\)/gi, '(expires today)')
    .replace(/\b0\s*days?\s*left\b/gi, 'expires today');
}

function getDayGroupLabel(dateString: string): string {
  const d = new Date(dateString);
  const todayStr = getLocalDateStr(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yesterday);
  const itemDateStr = getLocalDateStr(d);

  if (itemDateStr === todayStr) return 'Today';
  if (itemDateStr === yesterdayStr) return 'Yesterday';
  return formatDate(itemDateStr);
}

interface SwipeableRowProps {
  item: Notification;
  onPress: () => void;
  onDelete: () => void;
  onSendBirthdayWish?: () => void;
  getTypeIcon: (type?: string | null) => React.ReactNode;
  colors: ThemeColors;
  styles: ReturnType<typeof getNotificationsStyles>;
}

function SwipeableNotificationRow({
  item,
  onPress,
  onDelete,
  onSendBirthdayWish,
  getTypeIcon,
  styles,
}: SwipeableRowProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 10;
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          pan.setValue(Math.max(-80, gesture.dx));
        } else if (isOpen.current) {
          pan.setValue(Math.min(0, -80 + gesture.dx));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -35) {
          isOpen.current = true;
          Animated.spring(pan, {
            toValue: -80,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        } else {
          isOpen.current = false;
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const closeRow = () => {
    isOpen.current = false;
    Animated.spring(pan, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const titleText = useMemo(() => cleanTitle(item.title), [item.title]);
  const messageText = useMemo(() => cleanMessage(item.message), [item.message]);

  return (
    <View style={styles.swipeRowWrapper}>
      {/* Background delete action revealed upon swipe */}
      <View style={styles.swipeDeleteActionBackground}>
        <TouchableOpacity
          onPress={() => {
            closeRow();
            onDelete();
          }}
          style={styles.swipeDeleteButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Delete notification ${titleText}`}
        >
          <Trash2 size={18} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground row content */}
      <Animated.View
        style={[styles.rowForeground, { transform: [{ translateX: pan }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (isOpen.current) {
              closeRow();
            } else {
              onPress();
            }
          }}
          style={styles.rowTouchable}
        >
          <View style={styles.iconCol}>{getTypeIcon(item.type)}</View>

          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <Text style={styles.notifTitle} numberOfLines={1}>
                {titleText}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>

            <Text style={styles.notifMessage} numberOfLines={3}>
              {messageText}
            </Text>

            {item.type?.toUpperCase() === 'BIRTHDAY' && onSendBirthdayWish && (
              <TouchableOpacity
                style={styles.birthdayWishBtn}
                onPress={onSendBirthdayWish}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Send WhatsApp Birthday Greeting"
              >
                <MessageCircle size={13} color="#FFFFFF" />
                <Text style={styles.birthdayWishBtnText}>Send WhatsApp Wish</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.notifTime}>{formatDateTime(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getNotificationsStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | 'birthday'>('all');

  // Infinite query for virtualization and pagination
  const {
    data: pagedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['mobile-notifications-paged', user?.id, filter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user?.id) return { items: [], nextPage: undefined };
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('read', false);
      } else if (filter === 'birthday') {
        query = query.eq('type', 'BIRTHDAY');
      }

      const { data, error } = await query.range(from, to);
      if (error) {
        console.error('[NotificationsScreen] Fetch error:', error.message);
        throw error;
      }
      const items = (data || []) as Notification[];
      return {
        items,
        nextPage: items.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextPage,
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  // Query exact total count for segmented control
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['mobile-notifications-total-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},user_id.is.null`);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Query exact unread count for segmented control
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['mobile-notifications-unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('read', false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Query birthday notification count for segmented control
  const { data: birthdayCount = 0 } = useQuery({
    queryKey: ['mobile-notifications-birthday-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('type', 'BIRTHDAY');
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mobile-notifications-paged'] });
    qc.invalidateQueries({ queryKey: ['mobile-notifications-total-count'] });
    qc.invalidateQueries({ queryKey: ['mobile-notifications-unread-count'] });
    qc.invalidateQueries({ queryKey: ['mobile-notifications-birthday-count'] });
    qc.invalidateQueries({ queryKey: ['mobile-notifications'] });
    qc.invalidateQueries({ queryKey: ['unread-notifications'] });
    qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
  }, [qc]);

  const onRefresh = useCallback(() => {
    haptics.light();
    invalidateAll();
  }, [invalidateAll]);

  const markAsRead = async (id: string) => {
    haptics.light();
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    invalidateAll();
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    haptics.success();
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .or(`user_id.eq.${user.id},user_id.is.null`);
      if (error) {
        console.error('[Notifications] markAllAsRead error:', error.message);
      }
    } finally {
      invalidateAll();
    }
  };

  const deleteSingle = async (id: string) => {
    haptics.light();
    await supabase.from('notifications').delete().eq('id', id);
    invalidateAll();
  };

  const handleSendBirthdayWish = async (item: Notification) => {
    try {
      haptics.selection();

      // Extract ID or Name from message
      const idMatch = item.message.match(/\(ID:\s*([^)]+)\)/i);
      const nameMatch =
        item.message.match(/Happy Birthday to\s+(.*?)\s+\(ID:/i) ||
        item.message.match(/Happy Birthday to\s+([^!]+)/i);

      const memberIdCode = idMatch ? idMatch[1].trim() : null;
      const memberName = nameMatch ? nameMatch[1].trim() : null;

      let q = supabase
        .from('members')
        .select('id, member_id, full_name, mobile');

      if (memberIdCode) {
        q = q.or(`member_id.eq.${memberIdCode},id.eq.${memberIdCode}`);
      } else if (memberName) {
        q = q.ilike('full_name', `%${memberName}%`);
      }

      const { data: member, error } = await q.limit(1).maybeSingle();

      if (error || !member) {
        haptics.error();
        Alert.alert(
          'Member Profile',
          'Could not find member profile details for this birthday notification.'
        );
        return;
      }

      if (!member.mobile) {
        haptics.warning();
        Alert.alert(
          'No Mobile Number',
          `${member.full_name} does not have a recorded mobile phone number. Please update their profile with a valid WhatsApp phone number.`
        );
        return;
      }

      const wishMsg = buildBirthdayWishMessage(member.full_name);

      haptics.medium();
      Alert.alert(
        '🎂 Send Birthday Greeting',
        `Send a personalized WhatsApp birthday wish to ${member.full_name} (${member.mobile})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send on WhatsApp',
            style: 'default',
            onPress: async () => {
              haptics.success();
              await openWhatsAppLink(member.mobile!, wishMsg);
            },
          },
        ]
      );
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to open WhatsApp');
    }
  };

  const handleNotificationPress = async (item: Notification) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.type?.toUpperCase() === 'BIRTHDAY') {
      await handleSendBirthdayWish(item);
    }
  };

  const clearReadNotifications = async () => {
    if (!user?.id) return;
    haptics.warning();
    Alert.alert(
      'Clear Read Notifications',
      'Are you sure you want to permanently delete all read notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Read',
          style: 'destructive',
          onPress: async () => {
            haptics.medium();
            try {
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('read', true)
                .or(`user_id.eq.${user.id},user_id.is.null`);
              if (error) {
                console.error('[Notifications] clearRead error:', error.message);
              }
            } finally {
              invalidateAll();
            }
          },
        },
      ]
    );
  };

  const getTypeIcon = (type?: string | null) => {
    switch (type?.toUpperCase()) {
      case 'SUCCESS':
        return <CheckCircle size={18} color={colors.success} />;
      case 'WARNING':
        return <AlertTriangle size={18} color={colors.warning} />;
      case 'ERROR':
        return <XCircle size={18} color={colors.error} />;
      case 'BIRTHDAY':
        return <Cake size={18} color={colors.gold} />;
      default:
        return <Info size={18} color={colors.blueLight} />;
    }
  };

  const allLoadedItems = useMemo(() => {
    if (!pagedData?.pages) return [];
    return pagedData.pages.flatMap(page => page.items);
  }, [pagedData]);

  // Group by day for SectionList
  const sections = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const item of allLoadedItems) {
      const label = getDayGroupLabel(item.created_at);
      if (!map.has(label)) {
        map.set(label, []);
      }
      map.get(label)!.push(item);
    }
    return Array.from(map.entries()).map(([title, data]) => ({
      title,
      count: data.length,
      data,
    }));
  }, [allLoadedItems]);

  return (
    <View style={styles.container}>
      <FVEHeader
        title="NOTIFICATIONS"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.readAllBtn}>
                <CheckCheck size={14} color={colors.gold} />
                <Text style={styles.readAllBtnText}>Read All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={clearReadNotifications} style={styles.clearBtn}>
              <Trash2 size={13} color={colors.textMuted} />
              <Text style={styles.clearBtnText}>Clear Read</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Segmented Control for All / Unread / Birthday */}
      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setFilter('all');
            }}
            style={[styles.segmentBtn, filter === 'all' && styles.segmentBtnActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'all' }}
            accessibilityLabel={`All notifications, ${totalCount} total`}
          >
            <Text
              style={[
                styles.segmentText,
                filter === 'all' && styles.segmentTextActive,
              ]}
            >
              All ({totalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setFilter('unread');
            }}
            style={[styles.segmentBtn, filter === 'unread' && styles.segmentBtnActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'unread' }}
            accessibilityLabel={`Unread notifications, ${unreadCount} unread`}
          >
            <Text
              style={[
                styles.segmentText,
                filter === 'unread' && styles.segmentTextActive,
              ]}
            >
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setFilter('birthday');
            }}
            style={[styles.segmentBtn, filter === 'birthday' && styles.segmentBtnBirthday]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'birthday' }}
            accessibilityLabel={`Birthday notifications, ${birthdayCount} total`}
          >
            <Text
              style={[
                styles.segmentText,
                filter === 'birthday' && styles.segmentTextBirthday,
              ]}
            >
              🎂 ({birthdayCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Access to Renewal WhatsApp Batch */}
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('RenewalBatch')}
          style={styles.batchBanner}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Launch Renewal Reminders & WhatsApp Batch"
        >
          <View style={styles.batchBannerLeft}>
            <View style={styles.batchBannerIconPill}>
              <MessageCircle size={15} color={colors.gold} />
            </View>
            <View>
              <Text style={styles.batchBannerTitle}>RENEWAL REMINDERS</Text>
              <Text style={styles.batchBannerSub}>Launch batch WhatsApp expiry queue</Text>
            </View>
          </View>
          <Text style={styles.batchBannerArrow}>❯</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Access to Festival Calendar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('FestivalCalendar')}
          style={styles.batchBanner}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open Festival Calendar"
        >
          <View style={styles.batchBannerLeft}>
            <View style={styles.batchBannerIconPill}>
              <CalendarDays size={15} color={colors.gold} />
            </View>
            <View>
              <Text style={styles.batchBannerTitle}>FESTIVAL CALENDAR</Text>
              <Text style={styles.batchBannerSub}>View & manage shared festival events</Text>
            </View>
          </View>
          <Text style={styles.batchBannerArrow}>❯</Text>
        </TouchableOpacity>
      </View>

      {/* Virtualized and Paginated SectionList Grouped by Day */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <SwipeableNotificationRow
            item={item}
            onPress={() => handleNotificationPress(item)}
            onDelete={() => deleteSingle(item.id)}
            onSendBirthdayWish={() => handleSendBirthdayWish(item)}
            getTypeIcon={getTypeIcon}
            colors={colors}
            styles={styles}
          />
        )}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.loadingMoreFooter}>
              <Text style={styles.loadingMoreText}>Loading more notifications...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<Bell size={40} color={colors.gold} />}
              title={
                filter === 'unread'
                  ? 'No Unread Notifications'
                  : filter === 'birthday'
                  ? 'No Birthday Notifications'
                  : 'No Notifications'
              }
              description={
                filter === 'unread'
                  ? 'All caught up! You have zero unread alerts.'
                  : filter === 'birthday'
                  ? 'Birthday notifications for members will appear here.'
                  : 'System alerts and renewal reminders will show up here.'
              }
            />
          ) : null
        }
      />
    </View>
  );
}

const getNotificationsStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    readAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.12)',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    readAllBtnText: {
      color: colors.gold,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    clearBtnText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    // Segmented control
    segmentedContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    segmentedControl: {
      flexDirection: 'row',
      height: 38,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    segmentBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    segmentBtnActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.16)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
    },
    segmentText: {
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    segmentTextActive: {
      color: colors.gold,
    },
    segmentBtnBirthday: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.16)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
      borderRadius: 8,
    },
    segmentTextBirthday: {
      color: colors.gold,
    },
    batchBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#141824' : '#FFFBEB',
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : '#FDE68A',
      minHeight: 44,
    },
    batchBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    batchBannerIconPill: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    batchBannerTitle: {
      fontFamily: typography.fonts.rajdhani,
      fontSize: 12,
      fontWeight: '700',
      color: colors.gold,
      letterSpacing: 0.5,
    },
    batchBannerSub: {
      fontFamily: typography.fonts.inter,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    batchBannerArrow: {
      fontSize: 13,
      color: colors.gold,
      fontWeight: '700',
    },
    listContent: {
      paddingBottom: 40,
    },
    dayHeader: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
      backgroundColor: colors.background,
    },
    dayHeaderText: {
      fontSize: 11,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    // Plain rows with dividers instead of cards
    swipeRowWrapper: {
      position: 'relative',
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    swipeDeleteActionBackground: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: 80,
      backgroundColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swipeDeleteButton: {
      width: 80,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    swipeDeleteText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    rowForeground: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDark,
    },
    rowTouchable: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    iconCol: {
      marginRight: 12,
      marginTop: 2,
    },
    textCol: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    notifTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      flex: 1,
      marginRight: 6,
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.gold,
    },
    notifMessage: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      marginTop: 3,
      lineHeight: 16,
    },
    notifTime: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      marginTop: 4,
    },
    birthdayWishBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: '#25D366',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      marginTop: 6,
      shadowColor: '#25D366',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 2,
    },
    birthdayWishBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    loadingMoreFooter: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingMoreText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
    },
  });
