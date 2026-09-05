import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, Menu } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/api/supabase';
import { AppDrawerModal } from '@/components/layout/AppDrawerModal';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

interface FVEHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showLogo?: boolean;
  rightAction?: React.ReactNode;
  onNotificationsPress?: () => void;
  unreadCount?: number;
}

export function FVEHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  showLogo = true,
  rightAction,
  onNotificationsPress,
  unreadCount = 0,
}: FVEHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : insets.top;

  const isOwnerOrAdmin = Boolean(
    user?.role && ['OWNER', 'ADMIN'].includes(user.role.toUpperCase())
  );

  const { data: fetchedUnreadCount } = useQuery({
    queryKey: ['unread-notifications-count', user?.id, isOwnerOrAdmin],
    queryFn: async () => {
      if (!user?.id) return 0;
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      if (!isOwnerOrAdmin) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { count, error } = await query;
      if (error) {
        console.warn('[FVEHeader] Error fetching unread count:', error.message);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const finalUnreadCount = unreadCount || fetchedUnreadCount || 0;

  const handleNotificationPress = () => {
    haptics.light();
    if (onNotificationsPress) {
      onNotificationsPress();
    } else {
      navigation.navigate('Notifications');
    }
  };


  return (
    <>
      <View style={[styles.headerWrap, { paddingTop: topPad }]}>
        <View style={styles.container}>
          {/* Left: Back button OR Drawer Menu + Logo */}
          <View style={styles.leftContainer}>
            {showBack ? (
              <TouchableOpacity
                onPress={onBack}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={22} color={colors.gold} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setDrawerVisible(true);
                }}
                style={styles.menuButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Menu size={22} color={colors.gold} />
              </TouchableOpacity>
            )}

            {showLogo && !showBack ? (
              <Image
                source={require('@/../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : null}

            <View style={styles.titleContainer}>
              {title ? (
                <Text numberOfLines={1} style={styles.title}>
                  {title}
                </Text>
              ) : (
                <Text style={styles.brandTitle}>FITVERSE ELITE</Text>
              )}
              {subtitle && (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>

          {/* Right Action */}
          <View style={styles.rightContainer}>
            {user?.isStaffProfile && (
              <View style={styles.staffModeBadge}>
                <Text style={styles.staffModeText}>STAFF MODE</Text>
              </View>
            )}

            {rightAction}

            {(!showBack || onNotificationsPress) && (
              <TouchableOpacity
                onPress={handleNotificationPress}
                style={styles.notificationButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Bell size={20} color={colors.gold} />
                {finalUnreadCount > 0 && (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeText}>
                      {finalUnreadCount > 9 ? '9+' : finalUnreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Slide-out Full App Navigation Drawer */}
      <AppDrawerModal
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: '#080A0D',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#080A0D',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  brandTitle: {
    color: colors.gold,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staffModeBadge: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  staffModeText: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
