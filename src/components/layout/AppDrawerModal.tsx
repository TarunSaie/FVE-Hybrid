import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  BackHandler,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  LayoutDashboard,
  Users,
  Award,
  CreditCard,
  UserCheck,
  BarChart3,
  DollarSign,
  ClipboardList,
  Bell,
  Settings,
  LogOut,
  X,
  ChevronRight,
  QrCode,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { FVEBadge } from '@/components/common/FVEBadge';
import { canAccessRoute } from '@/constants/permissions';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppDrawerModalProps {
  visible: boolean;
  onClose: () => void;
}

interface NavItemDef {
  screen: string;
  icon: any;
  label: string;
  route: string;
}

interface NavSection {
  title: string;
  items: NavItemDef[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'CORE OPERATIONS',
    items: [
      { screen: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard', route: '/' },
      { screen: 'Members', icon: Users, label: 'Members', route: '/members' },
      { screen: 'Attendance', icon: UserCheck, label: 'Attendance', route: '/attendance' },
      { screen: 'QRScanner', icon: QrCode, label: 'QR Scanner Kiosk', route: '/scanner' },
    ],
  },
  {
    title: 'FINANCE & PLANS',
    items: [
      { screen: 'Payments', icon: CreditCard, label: 'Payments', route: '/payments' },
      { screen: 'MembershipPlans', icon: Award, label: 'Membership Plans', route: '/plans' },
      { screen: 'Expenses', icon: DollarSign, label: 'Gym Expenses', route: '/expenses' },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { screen: 'Staff', icon: ClipboardList, label: 'Staff Directory', route: '/staff' },
      { screen: 'Reports', icon: BarChart3, label: 'Reports & Analytics', route: '/reports' },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { screen: 'Notifications', icon: Bell, label: 'Notifications', route: '/notifications' },
      { screen: 'Settings', icon: Settings, label: 'Settings & Profile', route: '/settings' },
    ],
  },
];

export function AppDrawerModal({ visible, onClose }: AppDrawerModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  // Internal rendered state allows smooth slide-out and backdrop fade before unmounting
  const [rendered, setRendered] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-320)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track active screen for highlighting
  const activeRouteName = useNavigationState(state => {
    if (!state || !state.routes || state.routes.length === 0) return 'Dashboard';
    const current = state.routes[state.index];
    if (current.name === 'MainTabs') {
      const tabState = current.state;
      if (tabState && tabState.routes && tabState.routes.length > 0) {
        const tabIndex = typeof tabState.index === 'number' ? tabState.index : 0;
        return tabState.routes[tabIndex]?.name || 'Dashboard';
      }
      return 'Dashboard';
    }
    return current.name;
  });

  const closeWithAnimation = useCallback((afterClose?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -320,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRendered(false);
      onClose();
      afterClose?.();
    });
  }, [slideAnim, fadeAnim, onClose]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 0,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      closeWithAnimation();
    }
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeWithAnimation();
      return true;
    });
    return () => backSub.remove();
  }, [rendered, closeWithAnimation]);

  const handleNavigate = (screenName: string) => {
    haptics.selection();
    closeWithAnimation(() => {
      if (screenName === 'Dashboard') {
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
      } else if (screenName === 'Members') {
        navigation.navigate('MainTabs', { screen: 'Members' });
      } else if (screenName === 'Attendance') {
        navigation.navigate('MainTabs', { screen: 'Attendance' });
      } else if (screenName === 'Payments') {
        navigation.navigate('MainTabs', { screen: 'Payments' });
      } else if (screenName === 'Settings') {
        navigation.navigate('MainTabs', { screen: 'Settings' });
      } else if (screenName === 'MembershipPlans') {
        navigation.navigate('MembershipPlans');
      } else if (screenName === 'Expenses') {
        navigation.navigate('Expenses');
      } else if (screenName === 'Reports') {
        navigation.navigate('Reports');
      } else if (screenName === 'Staff') {
        navigation.navigate('Staff');
      } else if (screenName === 'Notifications') {
        navigation.navigate('Notifications');
      } else if (screenName === 'QRScanner') {
        navigation.navigate('QRScanner');
      }
    });
  };

  const handleLogoutConfirm = () => {
    haptics.warning();
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of FitVerse Elite?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            closeWithAnimation(async () => {
              await logout();
            });
          },
        },
      ]
    );
  };

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={() => closeWithAnimation()}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop with animated opacity */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Pressable style={styles.backdropTap} onPress={() => closeWithAnimation()} />
        </Animated.View>

        {/* Drawer Container — smoothly slides in and out */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 6 : 2),
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.drawerContent}>
            {/* Header: Logo + Brand + Close */}
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Image
                  source={require('@/../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.brandTitle}>FITVERSE</Text>
                  <Text style={styles.brandSubtitle}>ELITE MOBILE</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  closeWithAnimation();
                }}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Interactive User Profile Card */}
            <TouchableOpacity
              onPress={() => handleNavigate('Settings')}
              style={styles.userSection}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrapper}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <LinearGradient
                    colors={['#2A3245', '#161A26']}
                    style={styles.avatarGradient}
                  >
                    <Text style={styles.avatarText}>
                      {(user?.full_name?.trim()?.charAt(0) || user?.username?.trim()?.charAt(0) || 'O').toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text numberOfLines={1} style={styles.userName}>
                  {(user?.full_name || user?.username || 'User').toUpperCase()}
                </Text>
                <View style={styles.userRoleRow}>
                  <FVEBadge role={user?.role} size="sm" />
                </View>
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Structured Categorical Navigation List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollListContent}
              showsVerticalScrollIndicator={false}
            >
              {NAV_SECTIONS.map((section, idx) => {
                const accessibleItems = section.items.filter(item =>
                  canAccessRoute(user?.role, item.route)
                );

                if (accessibleItems.length === 0) return null;

                return (
                  <View key={section.title} style={idx > 0 ? styles.sectionGroup : undefined}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>

                    {accessibleItems.map((item) => {
                      const isActive = activeRouteName === item.screen;
                      const IconComponent = item.icon;

                      return (
                        <Pressable
                          key={item.screen}
                          onPress={() => handleNavigate(item.screen)}
                          style={({ pressed }) => [
                            styles.navItem,
                            isActive && styles.navItemActive,
                            pressed && styles.navItemPressed,
                          ]}
                          android_ripple={{
                            color: 'rgba(239, 161, 0, 0.15)',
                            borderless: false,
                          }}
                        >
                          <View
                            style={[
                              styles.navIconBox,
                              isActive && styles.navIconBoxActive,
                            ]}
                          >
                            <IconComponent
                              size={18}
                              color={isActive ? colors.gold : colors.textSecondary}
                            />
                          </View>

                          <Text
                            style={[
                              styles.navLabel,
                              isActive && styles.navLabelActive,
                            ]}
                          >
                            {item.label}
                          </Text>

                          {isActive ? (
                            <View style={styles.activePill}>
                              <Sparkles size={11} color={colors.gold} />
                              <Text style={styles.activePillText}>ACTIVE</Text>
                            </View>
                          ) : (
                            <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer Sign Out + Tagline with Safe Area Insets */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity
                onPress={handleLogoutConfirm}
                style={styles.logoutBtn}
                activeOpacity={0.7}
              >
                <View style={styles.logoutIconBox}>
                  <LogOut size={16} color={colors.error} />
                </View>
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
              <Text style={styles.footerTagline}>DISCIPLINE · STRENGTH · TRANSFORMATION</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdropTap: {
    flex: 1,
  },
  drawerContainer: {
    width: 300,
    maxWidth: '82%',
    backgroundColor: '#0D0F12',
    borderRightWidth: 1.2,
    borderRightColor: 'rgba(239, 161, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 24,
    height: '100%',
  },
  drawerContent: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 161, 0, 0.15)',
    backgroundColor: '#080A0D',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandTitle: {
    color: colors.gold,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 18,
  },
  brandSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.fonts.orbitron,
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#111419',
    gap: 12,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: 'rgba(239, 161, 0, 0.4)',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.goldBright,
    fontSize: 18,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '900',
    includeFontPadding: false,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userRoleRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionGroup: {
    marginTop: 14,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  navItemPressed: {
    backgroundColor: 'rgba(239, 161, 0, 0.08)',
  },
  navIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navIconBoxActive: {
    backgroundColor: 'rgba(239, 161, 0, 0.22)',
  },
  navLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  navLabelActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 161, 0, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0A0C0F',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: colors.error,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerTagline: {
    color: 'rgba(239, 161, 0, 0.35)',
    fontSize: 9,
    fontFamily: typography.fonts.orbitron,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 12,
  },
});
