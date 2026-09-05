import React, { useCallback, useEffect } from 'react';
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
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDateTime } from '@/utils/date';
import { haptics } from '@/utils/haptics';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const isOwnerOrAdmin = Boolean(
    user?.role && ['OWNER', 'ADMIN'].includes(user.role.toUpperCase())
  );

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['mobile-notifications', user?.id, isOwnerOrAdmin],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isOwnerOrAdmin) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { data, error } = await query;
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

  // Realtime subscription for instant notification updates
  useEffect(() => {
    const channel = supabase
      .channel('mobile-notifications-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          invalidateAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateAll]);

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

  const unreadCount = (notifications || []).filter(n => !n.read).length;
  const totalCount = (notifications || []).length;

  return (
    <View style={styles.container}>
      <FVEHeader
        title="NOTIFICATIONS"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead} style={styles.readAllBtn}>
              <CheckCheck size={14} color={colors.gold} />
              <Text style={styles.readAllBtnText}>Read All</Text>
            </TouchableOpacity>
          ) : totalCount > 0 ? (
            <TouchableOpacity onPress={clearAllNotifications} style={styles.clearBtn}>
              <Trash2 size={14} color={colors.textMuted} />
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={notifications || []}
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
              title="No Notifications"
              description="System alerts and renewal reminders will show up here."
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldMuted,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  unreadCard: {
    borderColor: colors.goldBorder,
    backgroundColor: '#141820',
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
