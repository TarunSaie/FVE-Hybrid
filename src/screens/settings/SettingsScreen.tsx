import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Award,
  DollarSign,
  BarChart3,
  Shield,
  Bell,
  LogOut,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Volume2,
  BellRing,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Dumbbell,
  Sun,
  Moon,
  Laptop,
  Palette,
  Check,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEKeyboardAwareContainer } from '@/components/common/FVEKeyboardAwareContainer';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/api/supabase';
import { typography } from '@/constants/typography';
import { APP_NAME, TAGLINE, CHIRVEX_WEBSITE } from '@/constants/branding';
import { ThemeColors } from '@/constants/colors';
import { haptics } from '@/utils/haptics';
import { sounds } from '@/utils/sounds';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, login, logout, clearStaffProfile } = useAuth();
  const { theme, setTheme, colors, isDark } = useTheme();

  const fullNameRef = useRef(user?.full_name || '');
  const phoneRef = useRef(user?.phone || '');
  const newPasswordRef = useRef('');
  const confirmPasswordRef = useRef('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const styles = useMemo(() => getSettingsStyles(colors, isDark), [colors, isDark]);

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

  const themeOptions = [
    {
      id: 'dark' as const,
      label: 'Dark Mode',
      desc: 'Obsidian & Gold',
      icon: Moon,
    },
    {
      id: 'light' as const,
      label: 'Light Mode',
      desc: 'Pearl & Slate',
      icon: Sun,
    },
    {
      id: 'system' as const,
      label: 'System Auto',
      desc: 'Follow Device',
      icon: Laptop,
    },
  ];

  return (
    <View style={styles.container}>
      <FVEHeader title="MORE & SETTINGS" />

      <FVEKeyboardAwareContainer
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <LinearGradient
          colors={
            isDark
              ? ['#181D2A', '#10141E', '#0B0D13']
              : ['#FFFFFF', '#FAF8F5', '#F5EFE6']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userCard}
        >
          <View style={styles.userAvatar}>
            {user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={styles.userAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={
                  isDark
                    ? ['#2A3245', '#161A26', '#0E1018']
                    : ['#FFFBEB', '#FEF3C7', '#FDE68A']
                }
                style={styles.userAvatarGradient}
              >
                <View style={styles.userAvatarGlow} />
                <Text style={styles.userInitial}>
                  {(user?.full_name?.trim()?.charAt(0) || user?.username?.trim()?.charAt(0) || (user?.role === 'OWNER' ? 'O' : 'U')).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text numberOfLines={1} style={styles.userName}>
                {(user?.full_name || user?.username || 'User').toUpperCase()}
              </Text>
              {user?.role === 'OWNER' && (
                <View style={styles.ownerPill}>
                  <Sparkles size={9} color={isDark ? colors.goldBright : colors.gold} />
                  <Text style={styles.ownerPillText}>PRIMARY OWNER</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail}>{user?.email || 'System User'}</Text>
            <FVEBadge role={user?.role} size="sm" style={{ marginTop: 6 }} />
          </View>
        </LinearGradient>

        {/* Staff Switch Alert Banner */}
        {isStaff && (
          <View style={styles.staffAlertBox}>
            <Text style={styles.staffAlertText}>
              Operating in Staff Mode as {user?.full_name || user?.username}.
            </Text>
            <TouchableOpacity onPress={() => clearStaffProfile()} style={styles.exitStaffBtn}>
              <Text style={styles.exitStaffBtnText}>Exit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Appearance & Theme Section */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Palette size={16} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={styles.sectionHeader}>APPEARANCE & THEME</Text>
          </View>
          <Text style={styles.diagnosticsSubtext}>
            Customize how FitVerse Elite looks on your device. Choose between Dark luxury or Light Pearl aesthetics.
          </Text>

          <View style={styles.themeGrid}>
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              const IconComp = opt.icon;

              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    haptics.selection();
                    setTheme(opt.id);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.themeOptionCard,
                    isSelected && styles.themeOptionCardActive,
                  ]}
                >
                  <View style={styles.themeOptionHeader}>
                    <View
                      style={[
                        styles.themeOptionIcon,
                        isSelected && styles.themeOptionIconActive,
                      ]}
                    >
                      <IconComp
                        size={15}
                        color={isSelected ? '#050505' : colors.textPrimary}
                      />
                    </View>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check size={10} color="#050505" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.themeOptionLabel,
                      isSelected && styles.themeOptionLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.themeOptionDesc}>
                    {opt.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
            onPress={() => navigation.navigate('PersonalTraining')}
            style={styles.menuItem}
          >
            <View style={styles.menuLeft}>
              <Dumbbell size={18} color={colors.roleTrainer} />
              <Text style={styles.menuTitle}>Personal Training (Coaching)</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={[styles.menuItem, { borderBottomColor: 'transparent' }]}
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

        {/* Password Security */}
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

        {/* Native Audio & Haptic Diagnostics */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Volume2 size={16} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={styles.sectionHeader}>AUDIO & SOUND FEEDBACK</Text>
          </View>
          <Text style={styles.diagnosticsSubtext}>
            Test native audio chimes and vibration haptics for check-ins and alerts.
          </Text>

          <View style={styles.soundTestGrid}>
            <TouchableOpacity
              onPress={() => {
                haptics.success();
                sounds.checkinSuccess();
              }}
              style={styles.soundTestBtn}
              activeOpacity={0.75}
            >
              <CheckCircle size={16} color={colors.success} />
              <Text style={styles.soundTestBtnText}>Check-In Chime</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptics.warning();
                sounds.checkinAlready();
              }}
              style={styles.soundTestBtn}
              activeOpacity={0.75}
            >
              <AlertTriangle size={16} color={colors.warning} />
              <Text style={styles.soundTestBtnText}>Already Checked-In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptics.error();
                sounds.qrInvalid();
              }}
              style={styles.soundTestBtn}
              activeOpacity={0.75}
            >
              <XCircle size={16} color={colors.error} />
              <Text style={styles.soundTestBtnText}>Invalid QR Buzz</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptics.notification();
                sounds.notification();
              }}
              style={styles.soundTestBtn}
              activeOpacity={0.75}
            >
              <BellRing size={16} color={colors.gold} />
              <Text style={styles.soundTestBtnText}>Notification Alert</Text>
            </TouchableOpacity>
          </View>
        </View>

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

        {/* Sign Out Button */}
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

const getSettingsStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 110,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 119, 6, 0.25)',
      shadowColor: isDark ? colors.gold : '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    userAvatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      padding: 2,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 119, 6, 0.25)',
      shadowColor: isDark ? colors.gold : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 8,
      elevation: 3,
      marginRight: 14,
    },
    userAvatarImage: {
      width: 54,
      height: 54,
      borderRadius: 27,
    },
    userAvatarGradient: {
      flex: 1,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.gold,
      overflow: 'hidden',
    },
    userAvatarGlow: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.20)' : 'rgba(217, 119, 6, 0.15)',
    },
    userInitial: {
      color: isDark ? colors.goldBright : colors.gold,
      fontSize: 24,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '900',
      textAlign: 'center',
      includeFontPadding: false,
    },
    userInfo: {
      flex: 1,
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '800',
      letterSpacing: 0.5,
      flexShrink: 1,
    },
    ownerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.18)' : 'rgba(217, 119, 6, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.45)' : 'rgba(217, 119, 6, 0.35)',
      paddingHorizontal: 7,
      paddingVertical: 2.5,
      borderRadius: 6,
    },
    ownerPillText: {
      color: isDark ? colors.goldBright : colors.gold,
      fontSize: 8.5,
      fontFamily: typography.fonts.orbitron,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    userEmail: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.inter,
      marginTop: 3,
    },
    staffAlertBox: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 119, 6, 0.30)',
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.10)' : 'rgba(217, 119, 6, 0.08)',
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    staffAlertText: {
      color: colors.gold,
      fontSize: 11.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      flex: 1,
      marginRight: 8,
    },
    exitStaffBtn: {
      backgroundColor: colors.gold,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    exitStaffBtnText: {
      color: '#050505',
      fontSize: 10.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    themeGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    themeOptionCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1.5,
      padding: 10,
      minHeight: 88,
      justifyContent: 'space-between',
      backgroundColor: colors.cardBackground,
      borderColor: colors.borderDark,
    },
    themeOptionCardActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 119, 6, 0.08)',
      borderColor: colors.gold,
    },
    themeOptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    themeOptionIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
    },
    themeOptionIconActive: {
      backgroundColor: colors.gold,
    },
    checkCircle: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeOptionLabel: {
      color: colors.textPrimary,
      fontSize: 11.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    themeOptionLabelActive: {
      color: colors.gold,
      fontWeight: '800',
    },
    themeOptionDesc: {
      color: colors.textSecondary,
      fontSize: 9.5,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
    menuSection: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 6,
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
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDark,
    },
    menuLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    menuTitle: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    cardSection: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    aboutText: {
      color: colors.textPrimary,
      fontSize: 15,
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
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    diagnosticsSubtext: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      marginBottom: 12,
    },
    soundTestGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    soundTestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.borderDark,
      backgroundColor: isDark ? '#161A22' : '#F8FAFC',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      flexBasis: '48%',
      flexGrow: 1,
      minHeight: 44,
    },
    soundTestBtnText: {
      color: colors.textPrimary,
      fontSize: 11.5,
      fontFamily: typography.fonts.inter,
      fontWeight: '600',
    },
  });
