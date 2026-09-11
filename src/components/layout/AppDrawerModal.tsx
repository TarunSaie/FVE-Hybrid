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
  Sun,
  Moon,
  Laptop,
  Palette,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/typography';
import { FVEBadge } from '@/components/common/FVEBadge';
import { canAccessRoute, canAccessBrandStudio } from '@/constants/permissions';
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

const fallbackLogo = require('@/../assets/logo.png');

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
      { screen: 'BrandStudio', icon: Palette, label: 'Brand Studio', route: '/branding' },
    ],
  },
];

export function AppDrawerModal({ visible, onClose }: AppDrawerModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { brandConfig } = useBranding();
  const { colors, isDark, theme, setTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [rendered, setRendered] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-320)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track active screen for highlighting
  const activeRouteName = useNavigationState((state) => {
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

  const closeWithAnimation = useCallback(
    (afterClose?: () => void) => {
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
    },
    [slideAnim, fadeAnim, onClose]
  );

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
      } else if (screenName === 'Expenses' ) {
        navigation.navigate('Expenses');
      } else if (screenName === 'Reports') {
        navigation.navigate('Reports');
      } else if (screenName === 'Staff') {
        navigation.navigate('Staff');
      } else if (screenName === 'Notifications') {
        navigation.navigate('Notifications');
      } else if (screenName === 'QRScanner') {
        navigation.navigate('QRScanner');
      } else if (screenName === 'BrandStudio') {
        navigation.navigate('BrandStudio');
      }
    });
  };

  const handleLogoutConfirm = () => {
    haptics.warning();
    Alert.alert(
      'Sign Out',
      `Are you sure you want to sign out of ${brandConfig.gym_name}?`,
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

  const canAccessBrandSection = canAccessBrandStudio(user?.role, user?.email);

  const drawerItems = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessRoute(user?.role, item.route, user?.email)),
  })).filter((section) => section.items.length > 0);

  const filteredNavSections = canAccessBrandSection ? NAV_SECTIONS : NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.route !== '/branding'),
  })).filter((section) => section.items.length > 0);

  const visibleSections = filteredNavSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessRoute(user?.role, item.route, user?.email)),
  })).filter((section) => section.items.length > 0);

  const navSections = visibleSections;

  const drawerBg = isDark ? '#0D0F12' : colors.cardBackground;
  const drawerBorder = isDark ? 'rgba(239, 161, 0, 0.3)' : colors.borderDark;
  const headerBg = isDark ? '#080A0D' : colors.surfaceLight;
  const userSectionBg = isDark ? '#111419' : colors.surface;
  const logoSource = brandConfig.logo_url ? { uri: brandConfig.logo_url } : fallbackLogo;

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
              backgroundColor: colors.overlay,
              opacity: fadeAnim,
            },
          ]}
        >
          <Pressable style={styles.backdropTap} onPress={() => closeWithAnimation()} />
        </Animated.View>

        {/* Drawer Container */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              backgroundColor: drawerBg,
              borderRightColor: drawerBorder,
              paddingTop: insets.top + (Platform.OS === 'android' ? 6 : 2),
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.drawerContent}>
            {/* Header: Logo + Brand + Close */}
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: colors.borderDark }]}>
              <View style={styles.logoRow}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                <View>
                  <Text style={[styles.brandTitle, { color: colors.gold }]}>{brandConfig.gym_name.toUpperCase()}</Text>
                  <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>{brandConfig.slogan.toUpperCase()}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  closeWithAnimation();
                }}
                style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)' }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Interactive User Profile Card */}
            <TouchableOpacity
              onPress={() => handleNavigate('Settings')}
              style={[styles.userSection, { backgroundColor: userSectionBg, borderBottomColor: colors.borderDark }]}
              activeOpacity={0.8}
            >
              <View style={[styles.avatarWrapper, { borderColor: colors.gold }]}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <LinearGradient
                    colors={isDark ? ['#2A3245', '#161A26'] : ['#E2E8F0', '#CBD5E1']}
                    style={styles.avatarGradient}
                  >
                    <Text style={[styles.avatarText, { color: colors.gold }]}>
                      {(user?.full_name?.trim()?.charAt(0) || user?.username?.trim()?.charAt(0) || 'O').toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text numberOfLines={1} style={[styles.userName, { color: colors.textPrimary }]}>
                  {(user?.full_name || user?.username || 'User').toUpperCase()}
                </Text>
                <View style={styles.userRoleRow}>
                  <FVEBadge role={user?.role} size="sm" />
                </View>
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Categorical Navigation List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollListContent}
              showsVerticalScrollIndicator={false}
            >
              {navSections.map((section, idx) => {
                const accessibleItems = section.items;

                if (accessibleItems.length === 0) return null;

                return (
                  <View key={section.title} style={idx > 0 ? styles.sectionGroup : undefined}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>

                    {accessibleItems.map((item) => {
                      const isActive = activeRouteName === item.screen;
                      const IconComponent = item.icon;

                      return (
                        <Pressable
                          key={item.screen}
                          onPress={() => handleNavigate(item.screen)}
                          style={({ pressed }) => [
                            styles.navItem,
                            isActive && [styles.navItemActive, { borderLeftColor: colors.gold, backgroundColor: colors.goldMuted }],
                            pressed && [styles.navItemPressed, { backgroundColor: colors.goldSubtle }],
                          ]}
                          android_ripple={{
                            color: colors.goldMuted,
                            borderless: false,
                          }}
                        >
                          <View
                            style={[
                              styles.navIconBox,
                              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' },
                              isActive && { backgroundColor: colors.goldMuted },
                            ]}
                          >
                            <IconComponent size={18} color={isActive ? colors.gold : colors.textSecondary} />
                          </View>

                          <Text
                            style={[
                              styles.navLabel,
                              { color: colors.textSecondary },
                              isActive && [styles.navLabelActive, { color: colors.gold }],
                            ]}
                          >
                            {item.label}
                          </Text>

                          {isActive ? (
                            <View style={[styles.activePill, { backgroundColor: colors.goldMuted }]}>
                              <Sparkles size={11} color={colors.gold} />
                              <Text style={[styles.activePillText, { color: colors.gold }]}>ACTIVE</Text>
                            </View>
                          ) : (
                            <ChevronRight size={16} color={colors.textSubtle} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer with Theme Switcher & Sign Out */}
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: headerBg,
                  borderTopColor: colors.borderDark,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              {/* Quick Theme Switcher */}
              <View style={[styles.themeRow, { backgroundColor: isDark ? '#14171C' : '#FFFFFF', borderColor: colors.borderDark }]}>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setTheme('light');
                  }}
                  style={[
                    styles.themeBtn,
                    theme === 'light' && [styles.themeBtnActive, { backgroundColor: colors.goldMuted, borderColor: colors.gold }],
                  ]}
                >
                  <Sun size={14} color={theme === 'light' ? colors.gold : colors.textMuted} />
                  <Text style={[styles.themeBtnText, { color: theme === 'light' ? colors.gold : colors.textMuted }]}>Light</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setTheme('dark');
                  }}
                  style={[
                    styles.themeBtn,
                    theme === 'dark' && [styles.themeBtnActive, { backgroundColor: colors.goldMuted, borderColor: colors.gold }],
                  ]}
                >
                  <Moon size={14} color={theme === 'dark' ? colors.gold : colors.textMuted} />
                  <Text style={[styles.themeBtnText, { color: theme === 'dark' ? colors.gold : colors.textMuted }]}>Dark</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setTheme('system');
                  }}
                  style={[
                    styles.themeBtn,
                    theme === 'system' && [styles.themeBtnActive, { backgroundColor: colors.goldMuted, borderColor: colors.gold }],
                  ]}
                >
                  <Laptop size={14} color={theme === 'system' ? colors.gold : colors.textMuted} />
                  <Text style={[styles.themeBtnText, { color: theme === 'system' ? colors.gold : colors.textMuted }]}>Auto</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleLogoutConfirm}
                style={[styles.logoutBtn, { backgroundColor: colors.errorMuted, borderColor: colors.errorBorder }]}
                activeOpacity={0.7}
              >
                <View style={[styles.logoutIconBox, { backgroundColor: colors.errorMuted }]}>
                  <LogOut size={16} color={colors.error} />
                </View>
                <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
              </TouchableOpacity>
              <Text style={[styles.footerTagline, { color: colors.gold, opacity: 0.5 }]}>
                {brandConfig.slogan.toUpperCase()}
              </Text>
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
  },
  backdropTap: {
    flex: 1,
  },
  drawerContainer: {
    width: 300,
    maxWidth: '82%',
    borderRightWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.5,
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
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 18,
  },
  brandSubtitle: {
    fontSize: 10,
    fontFamily: typography.fonts.orbitron,
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    borderWidth: 1.5,
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
    fontSize: 18,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '900',
    includeFontPadding: false,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
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
    borderLeftWidth: 3,
  },
  navItemPressed: {},
  navIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  navLabelActive: {
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    fontSize: 9,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeBtnActive: {},
  themeBtnText: {
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  logoutIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerTagline: {
    fontSize: 9,
    fontFamily: typography.fonts.orbitron,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 12,
  },
});
