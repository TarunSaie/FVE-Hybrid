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
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Cake,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { Notification } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDateTime } from '@/utils/date';
import { haptics } from '@/utils/haptics';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getNotificationsStyles(colors, isDark), [colors, isDark]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['mobile-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[NotificationsScreen] Fetch error:', error.message);
        throw error;
      }
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const invalidateAll = useCallback(() => {
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
    const unreadIds = (notifications || []).filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    haptics.success();
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);
    invalidateAll();
  };

  const deleteSingle = async (id: string) => {
    haptics.light();
    await supabase.from('notifications').delete().eq('id', id);
    invalidateAll();
  };

  const clearReadNotifications = async () => {
    const readIds = (notifications || []).filter(n => n.read).map(n => n.id);
    if (readIds.length === 0) return;
    haptics.warning();
    Alert.alert(
      'Clear Read Notifications',
      `Delete all ${readIds.length} read notifications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Read',
          style: 'destructive',
          onPress: async () => {
            haptics.medium();
            await supabase
              .from('notifications')
              .delete()
              .in('id', readIds);
            invalidateAll();
          },
        },
      ]
    );
  };

  const clearAllNotifications = async () => {
    const allIds = (notifications || []).map(n => n.id);
    if (allIds.length === 0) return;
    haptics.warning();
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            haptics.medium();
            await supabase
              .from('notifications')
              .delete()
              .in('id', allIds);
            invalidateAll();
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

  const allNotifications = notifications || [];
  const unreadCount = allNotifications.filter(n => !n.read).length;
  const readCount = allNotifications.filter(n => n.read).length;
  const totalCount = allNotifications.length;

  const filteredNotifications = filter === 'unread'
    ? allNotifications.filter(n => !n.read)
    : allNotifications;

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
            {readCount > 0 && (
              <TouchableOpacity onPress={clearReadNotifications} style={styles.clearBtn}>
                <Trash2 size={13} color={colors.textMuted} />
                <Text style={styles.clearBtnText}>Clear Read</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Segmented Filter Bar: ALL vs UNREAD */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setFilter('all');
          }}
          style={[styles.tabBtn, filter === 'all' && styles.tabBtnActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, filter === 'all' && styles.tabBtnTextActive]}>
            ALL ({totalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setFilter('unread');
          }}
          style={[styles.tabBtn, filter === 'unread' && styles.tabBtnActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, filter === 'unread' && styles.tabBtnTextActive]}>
            UNREAD ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredNotifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
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
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => !item.read && markAsRead(item.id)}
            activeOpacity={0.8}
            style={[styles.notifCard, !item.read && styles.unreadCard]}
          >
            <View style={styles.notifRow}>
              <View style={styles.iconCol}>{getTypeIcon(item.type)}</View>

              <View style={styles.textCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <View style={styles.actionRow}>
                    {!item.read && <View style={styles.unreadDot} />}
                    <TouchableOpacity
                      onPress={() => deleteSingle(item.id)}
                      style={styles.deleteItemBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={13} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.notifMessage}>{item.message}</Text>
                <Text style={styles.notifTime}>
                  {formatDateTime(item.created_at)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <FVEEmptyState
              icon={<Bell size={40} color={colors.gold} />}
              title={filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
              description={
                filter === 'unread'
                  ? 'All caught up! You have zero unread alerts.'
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
      backgroundColor: colors.bgPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.bgSecondary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDefault,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.bgTertiary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBtnActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(239, 161, 0, 0.15)',
      borderColor: colors.gold,
    },
    tabBtnText: {
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    tabBtnTextActive: {
      color: colors.gold,
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
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    notifCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      elevation: isDark ? 0 : 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 2,
    },
    unreadCard: {
      borderColor: colors.goldBorder,
      backgroundColor: isDark ? '#141820' : '#FFFFFF',
    },
    notifRow: {
      flexDirection: 'row',
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
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      flex: 1,
      flexShrink: 1,
      marginRight: 6,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 6,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
    },
    deleteItemBtn: {
      padding: 2,
      opacity: 0.7,
    },
    notifMessage: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      marginTop: 4,
      lineHeight: 16,
    },
    notifTime: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.inter,
      marginTop: 6,
    },
  });
