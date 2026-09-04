import React, { useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Keyboard,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react-native';
import { FVEButton } from '@/components/common/FVEButton';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { haptics } from '@/utils/haptics';

// ─────────────────────────────────────────────────────────────────────────────
// Isolated uncontrolled input — NO `value` prop.
// Typing never triggers a parent re-render; focus is 100% owned by the OS.
// ─────────────────────────────────────────────────────────────────────────────
interface NativeFieldProps {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address';
  returnKeyType?: 'next' | 'go';
  secureTextEntry?: boolean;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  rightElement?: React.ReactNode;
  inputRef: React.RefObject<TextInput | null>;
}

const NativeField = memo(function NativeField({
  label,
  icon,
  placeholder,
  onChangeText,
  keyboardType = 'default',
  returnKeyType = 'next',
  secureTextEntry = false,
  onSubmitEditing,
  blurOnSubmit = false,
  rightElement,
  inputRef,
}: NativeFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.fieldBox, focused && styles.fieldBoxFocused]}>
        <View style={styles.leftIcon} pointerEvents="none">
          {icon}
        </View>
        <TextInput
          ref={inputRef}
          style={[styles.textInput, rightElement ? styles.textInputRight : undefined]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.gold}
          cursorColor={colors.gold}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightElement && (
          <View style={styles.rightEl} pointerEvents="box-none">
            {rightElement}
          </View>
        )}
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-contained eye toggle — uses setNativeProps so no parent re-render
// ─────────────────────────────────────────────────────────────────────────────
interface EyeButtonProps {
  passwordRef: React.RefObject<TextInput | null>;
}

const EyeButton = memo(function EyeButton({ passwordRef }: EyeButtonProps) {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => {
    haptics.selection();
    setVisible((prev) => {
      const next = !prev;
      (passwordRef.current as any)?.setNativeProps({ secureTextEntry: !next });
      return next;
    });
  }, [passwordRef]);

  return (
    <TouchableOpacity
      onPress={toggle}
      style={styles.eyeBtn}
      activeOpacity={0.7}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
    >
      {visible ? (
        <EyeOff size={18} color={colors.textSecondary} />
      ) : (
        <Eye size={18} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Login Screen
// ─────────────────────────────────────────────────────────────────────────────
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  // Values in refs — typing never triggers a parent re-render
  const emailVal = useRef('');
  const passwordVal = useRef('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleEmailChange = useCallback((t: string) => { emailVal.current = t; }, []);
  const handlePasswordChange = useCallback((t: string) => { passwordVal.current = t; }, []);
  const focusPassword = useCallback(() => { passwordRef.current?.focus(); }, []);

  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();
    const email = emailVal.current.trim();
    const password = passwordVal.current;

    if (!email) {
      haptics.warning();
      return Alert.alert('Required', 'Please enter your account email address');
    }
    if (!password) {
      haptics.warning();
      return Alert.alert('Required', 'Please enter your account password');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        haptics.success();
        login({
          id: data.user.id,
          email: data.user.email!,
          username: profile?.username || data.user.email!.split('@')[0],
          full_name: profile?.full_name || null,
          role: profile?.role || 'RECEPTIONIST',
          avatar_url: profile?.avatar_url || null,
          phone: profile?.phone || null,
        });
      }
    } catch (err: unknown) {
      haptics.error();
      Alert.alert(
        'Authentication Failed',
        (err as Error).message || 'Invalid email or password'
      );
    } finally {
      setLoading(false);
    }
  }, [login]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <LinearGradient
        colors={['rgba(239,161,0,0.16)', 'rgba(239,161,0,0.03)', 'transparent']}
        style={styles.aura}
        pointerEvents="none"
      />

      {/*
        KeyboardAwareScrollView automatically scrolls the focused input
        into view when the keyboard appears — no manual measurement needed.
      */}
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 28),
            paddingBottom: Math.max(insets.bottom + 32, 40),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 80}
        keyboardOpeningTime={0}
      >
        {/* ── Brand Hero ── */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Image
              source={require('@/../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.logoRing} />
          </View>
          <Text style={styles.brandTitle}>FITVERSE ELITE</Text>
          <Text style={styles.brandTagline}>DISCIPLINE · STRENGTH · TRANSFORMATION</Text>
          <View style={styles.welcomeWrap}>
            <Text style={styles.welcomeHeading}>Sign In</Text>
            <Text style={styles.welcomeSub}>
              Access your gym operational control center
            </Text>
          </View>
        </View>

        {/* ── Form Card ── */}
        <View style={styles.card}>
          <NativeField
            label="EMAIL ADDRESS"
            placeholder="name@fitverse.com"
            icon={<Mail size={18} color={colors.gold} />}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={focusPassword}
            blurOnSubmit={false}
            inputRef={emailRef}
          />

          <NativeField
            label="PASSWORD"
            placeholder="Enter password"
            icon={<Lock size={18} color={colors.gold} />}
            onChangeText={handlePasswordChange}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            blurOnSubmit
            inputRef={passwordRef}
            rightElement={<EyeButton passwordRef={passwordRef} />}
          />

          {/* Assistance Row */}
          <View style={styles.assistRow}>
            <View style={styles.securityPill}>
              <ShieldCheck size={13} color={colors.gold} />
              <Text style={styles.securityPillText}>Encrypted Session</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                Alert.alert(
                  'Account Assistance',
                  'Contact your gym administrator to reset your login credentials.'
                );
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.needHelp}>Need Help?</Text>
            </TouchableOpacity>
          </View>

          <FVEButton
            title="ENTER FITVERSE"
            onPress={handleLogin}
            loading={loading}
            variant="gold"
            size="lg"
            icon={<ArrowRight size={18} color="#050505" strokeWidth={2.5} />}
            iconPosition="right"
            style={styles.submitBtn}
          />
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>FitVerse Elite Mobile OS</Text>
          <Text style={styles.footerCredit}>
            Engineered for Gym Owners & Staff · Powered by Chirvex
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  aura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  // ── Hero ──
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  logoWrap: {
    position: 'relative',
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logo: {
    width: 74,
    height: 74,
  },
  logoRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.2,
    borderColor: 'rgba(239,161,0,0.28)',
  },
  brandTitle: {
    color: colors.gold,
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '800',
    letterSpacing: 2.2,
    textAlign: 'center',
  },
  brandTagline: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
    textAlign: 'center',
  },
  welcomeWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  welcomeHeading: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  welcomeSub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
    textAlign: 'center',
  },
  // ── Card ──
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#0D1015',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  // ── Field ──
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhaniMedium,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12151C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    height: 54,
    overflow: 'hidden',
  },
  fieldBoxFocused: {
    borderColor: colors.gold,
    backgroundColor: '#171B24',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  leftIcon: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  textInput: {
    flex: 1,
    height: 54,
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.inter,
    paddingRight: 14,
    paddingVertical: 0,
    outlineStyle: 'none' as any,
  },
  textInputRight: {
    paddingRight: 48,
  },
  rightEl: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Assistance ──
  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: -4,
    paddingHorizontal: 2,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239,161,0,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  securityPillText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  needHelp: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  submitBtn: {
    marginTop: 2,
  },
  // ── Footer ──
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerBrand: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footerCredit: {
    color: colors.textSubtle,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    marginTop: 3,
    textAlign: 'center',
  },
});
