import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  Platform,
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

const ALL_NAV_ITEMS = [
  { screen: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard', route: '/' },
  { screen: 'Members', icon: Users, label: 'Members', route: '/members' },
  { screen: 'MembershipPlans', icon: Award, label: 'Membership Plans', route: '/plans' },
  { screen: 'Payments', icon: CreditCard, label: 'Payments', route: '/payments' },
  { screen: 'Attendance', icon: UserCheck, label: 'Attendance', route: '/attendance' },
  { screen: 'QRScanner', icon: QrCode, label: 'QR Scanner Kiosk', route: '/scanner' },
  { screen: 'Reports', icon: BarChart3, label: 'Reports & Analytics', route: '/reports' },
  { screen: 'Expenses', icon: DollarSign, label: 'Gym Expenses', route: '/expenses' },
  { screen: 'Staff', icon: ClipboardList, label: 'Staff Directory', route: '/staff' },
  { screen: 'Notifications', icon: Bell, label: 'Notifications', route: '/notifications' },
  { screen: 'Settings', icon: Settings, label: 'Settings & Profile', route: '/settings' },
] as const;

export function AppDrawerModal({ visible, onClose }: AppDrawerModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backSub.remove();
  }, [visible, onClose]);

  const handleNavigate = (screenName: string) => {
    haptics.selection();
    onClose();

    // Map screen to navigation call
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
  };

  const handleLogout = async () => {
    haptics.heavy();
    onClose();
    await logout();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop tap dismiss */}
        <Pressable style={styles.backdropTap} onPress={onClose} />

        {/* Drawer Container */}
        <SafeAreaView style={styles.drawerContainer}>
          <View style={styles.drawerContent}>
            {/* Header: Logo + Close */}
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Image
                  source={require('@/../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.brandTitle}>FITVERSE</Text>
                  <Text style={styles.brandSubtitle}>ELITE</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onClose();
                }}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* User Profile Card */}
            <View style={styles.userSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text numberOfLines={1} style={styles.userName}>
                  {user?.full_name || user?.username}
                </Text>
                <FVEBadge role={user?.role} size="sm" style={{ marginTop: 2 }} />
              </View>
            </View>

            {/* Navigation List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollListContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionTitle}>ALL MODULES & FEATURES</Text>

              {ALL_NAV_ITEMS.map((item) => {
                const canAccess = canAccessRoute(user?.role, item.route);
                if (!canAccess) return null;

                const IconComponent = item.icon;

                return (
                  <TouchableOpacity
                    key={item.screen}
                    onPress={() => handleNavigate(item.screen)}
                    style={styles.navItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.navIconBox}>
                      <IconComponent size={18} color={colors.gold} />
                    </View>
                    <Text style={styles.navLabel}>{item.label}</Text>
                    <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Footer Sign Out */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleLogout}
                style={styles.logoutBtn}
                activeOpacity={0.7}
              >
                <LogOut size={18} color={colors.error} />
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
              <Text style={styles.footerTagline}>DISCIPLINE · STRENGTH · TRANSFORMATION</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerContainer: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: '#0D0F12',
    borderRightWidth: 1.2,
    borderRightColor: 'rgba(239, 161, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 20,
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
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#050505',
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  navIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
    letterSpacing: 0.4,
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
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: colors.error,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
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
