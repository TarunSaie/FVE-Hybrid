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
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDateTime } from '@/utils/date';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['mobile-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mobile-notifications'] });
    qc.invalidateQueries({ queryKey: ['unread-notifications'] });
  }, [qc]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    onRefresh();
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    onRefresh();
  };

  const clearAllNotifications = async () => {
    if (!user?.id) return;
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('notifications')
              .delete()
              .eq('user_id', user.id);
            onRefresh();
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
            onPress={() => markAsRead(item.id)}
            activeOpacity={0.8}
            style={[styles.notifCard, !item.read && styles.unreadCard]}
          >
            <View style={styles.notifRow}>
              <View style={styles.iconCol}>{getTypeIcon(item.type)}</View>

              <View style={styles.textCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
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
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
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
