import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  User,
  Lock,
  Award,
  DollarSign,
  BarChart3,
  Shield,
  Bell,
  LogOut,
  ExternalLink,
  ChevronRight,
  Save,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEKeyboardAwareContainer } from '@/components/common/FVEKeyboardAwareContainer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/api/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { APP_NAME, TAGLINE, CHIRVEX_WEBSITE } from '@/constants/branding';
import { haptics } from '@/utils/haptics';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, login, logout, clearStaffProfile } = useAuth();

  // Form values stored in refs — no re-render on each keystroke
  const fullNameRef = useRef(user?.full_name || '');
  const phoneRef = useRef(user?.phone || '');
  const newPasswordRef = useRef('');
  const confirmPasswordRef = useRef('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullNameRef.current.trim(),
          phone: phoneRef.current.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      login({
        ...user,
        full_name: fullNameRef.current.trim(),
        phone: phoneRef.current.trim() || null,
      });

      haptics.success();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPasswordRef.current) {
      haptics.warning();
      return Alert.alert('Error', 'Please enter a new password');
    }
    if (newPasswordRef.current.length < 6) {
      haptics.warning();
      return Alert.alert('Error', 'Password must be at least 6 characters');
    }
    if (newPasswordRef.current !== confirmPasswordRef.current) {
      haptics.warning();
      return Alert.alert('Error', 'Passwords do not match');
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordRef.current });
      if (error) throw error;

      haptics.success();
      Alert.alert('Success', 'Password updated successfully!');
      newPasswordRef.current = '';
      confirmPasswordRef.current = '';
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = () => {
    haptics.heavy();
    Alert.alert('Sign Out', 'Are you sure you want to log out of FitVerse Elite?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const isStaff = user?.isStaffProfile;
  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <View style={styles.container}>
      <FVEHeader title="SETTINGS & PREFERENCES" />

      <FVEKeyboardAwareContainer
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.full_name || user?.username}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <FVEBadge role={user?.role} size="sm" style={{ marginTop: 4 }} />
          </View>
        </View>

        {/* Staff Switch Alert Banner */}
        {isStaff && (
          <View style={styles.staffAlertBox}>
            <Text style={styles.staffAlertText}>
              You are currently operating in Staff Mode as {user?.full_name || user?.username}.
            </Text>
            <TouchableOpacity onPress={() => clearStaffProfile()} style={styles.exitStaffBtn}>
              <Text style={styles.exitStaffBtnText}>Exit Staff Mode</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Management Shortcuts */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionHeader}>MANAGEMENT & MODULES</Text>

          {isOwnerOrAdmin && (
            <>
              <TouchableOpacity
                onPress={() => navigation.navigate('MembershipPlans')}
                style={styles.menuItem}
              >
                <View style={styles.menuLeft}>
                  <Award size={18} color={colors.gold} />
                  <Text style={styles.menuTitle}>Membership Plans</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Expenses')}
                style={styles.menuItem}
              >
                <View style={styles.menuLeft}>
                  <DollarSign size={18} color={colors.gold} />
                  <Text style={styles.menuTitle}>Gym Expenses</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Reports')}
                style={styles.menuItem}
              >
                <View style={styles.menuLeft}>
                  <BarChart3 size={18} color={colors.gold} />
                  <Text style={styles.menuTitle}>Analytics & Reports</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Staff')}
                style={styles.menuItem}
              >
                <View style={styles.menuLeft}>
                  <Shield size={18} color={colors.gold} />
                  <Text style={styles.menuTitle}>Staff Directory & Roles</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.menuItem}
          >
            <View style={styles.menuLeft}>
              <Bell size={18} color={colors.gold} />
              <Text style={styles.menuTitle}>Notifications</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Profile Details Form */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>PROFILE INFORMATION</Text>
          <FVEInput
            label="FULL NAME"
            defaultValue={fullNameRef.current}
            onChangeText={(t) => { fullNameRef.current = t; }}
            placeholder="Your full name"
          />
          <FVEInput
            label="PHONE NUMBER"
            defaultValue={phoneRef.current}
            onChangeText={(t) => { phoneRef.current = t; }}
            placeholder="Your phone number"
            keyboardType="phone-pad"
          />
          <FVEButton
            title="SAVE PROFILE"
            onPress={handleSaveProfile}
            loading={profileLoading}
            variant="gold"
            size="md"
          />
        </View>

        {/* Password Security (Hidden for Staff Profile sessions) */}
        {!isStaff && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeader}>SECURITY & PASSWORD</Text>
            <FVEInput
              label="NEW PASSWORD"
              defaultValue=""
              onChangeText={(t) => { newPasswordRef.current = t; }}
              placeholder="••••••••"
              secureTextEntry
            />
            <FVEInput
              label="CONFIRM PASSWORD"
              defaultValue=""
              onChangeText={(t) => { confirmPasswordRef.current = t; }}
              placeholder="••••••••"
              secureTextEntry
            />
            <FVEButton
              title="UPDATE PASSWORD"
              onPress={handleUpdatePassword}
              loading={passwordLoading}
              variant="outline"
              size="md"
            />
          </View>
        )}

        {/* About FitVerse Elite */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>ABOUT FITVERSE ELITE</Text>
          <Text style={styles.aboutText}>{APP_NAME} SaaS Mobile Client</Text>
          <Text style={styles.taglineText}>{TAGLINE}</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(CHIRVEX_WEBSITE)}
            style={styles.chirvexLink}
          >
            <Text style={styles.chirvexLinkText}>Developed by Chirvex</Text>
            <ExternalLink size={14} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button (Hidden for staff profiles, which instead show Exit Staff Mode) */}
        {!isStaff ? (
          <FVEButton
            title="SIGN OUT"
            onPress={handleSignOut}
            variant="danger"
            size="md"
            icon={<LogOut size={16} color={colors.error} />}
            style={styles.signOutButton}
          />
        ) : (
          <FVEButton
            title="EXIT STAFF MODE"
            onPress={() => clearStaffProfile()}
            variant="outline"
            size="md"
            style={styles.signOutButton}
          />
        )}
      </FVEKeyboardAwareContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#191E24',
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userInitial: {
    color: colors.gold,
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  staffAlertBox: {
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  staffAlertText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  exitStaffBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exitStaffBtnText: {
    color: '#050505',
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  menuSection: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '600',
  },
  cardSection: {
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  aboutText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  taglineText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  chirvexLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  chirvexLinkText: {
    color: colors.gold,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: 6,
    alignSelf: 'center',
    width: '100%',
  },
});
