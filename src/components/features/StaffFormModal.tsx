import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { UserProfile, UserRole } from '@/types';
import { supabase } from '@/api/supabase';
import { OWNER_MANAGED_ROLES, ROLE_DISPLAY_NAMES } from '@/constants/permissions';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { createStaffAccount } from '@/utils/staffAuth';

interface StaffFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  staff?: UserProfile | null;
}

export function StaffFormModal({
  visible,
  onClose,
  onSaved,
  staff,
}: StaffFormModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStaffFormStyles(colors, isDark), [colors, isDark]);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('RECEPTIONIST');

  useEffect(() => {
    if (staff) {
      setFullName(staff.full_name || '');
      setEmail(staff.email || '');
      setPhone(staff.phone || '');
      setPassword('');
      setShowPassword(false);
      setRole((staff.role as UserRole) || 'RECEPTIONIST');
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setShowPassword(false);
      setRole('RECEPTIONIST');
    }
  }, [staff, visible]);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
    let pwd = 'FVE@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowPassword(true);
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Validation Error', 'Full name is required');
      return;
    }

    if (!staff) {
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        Alert.alert('Validation Error', 'A valid login email is required for the staff member');
        return;
      }
      if (!password || password.length < 6) {
        Alert.alert('Validation Error', 'Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    try {
      if (staff) {
        const username = trimmedEmail
          ? trimmedEmail.split('@')[0]
          : trimmedName.toLowerCase().replace(/\s+/g, '.');

        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: trimmedName,
            email: trimmedEmail || null,
            phone: trimmedPhone || null,
            role,
            username,
          })
          .eq('id', staff.id);
        if (error) throw error;

        Alert.alert('Success', 'Staff profile updated');
      } else {
        const result = await createStaffAccount({
          email: trimmedEmail,
          password,
          fullName: trimmedName,
          role,
          phone: trimmedPhone || null,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create staff account');
        }

        Alert.alert(
          'Staff Account Created',
          `${trimmedName} has been created!\n\nEmail: ${trimmedEmail}\nPassword: ${password}\n\nThey can now sign in directly on Web and Mobile.`,
          [{ text: 'OK' }]
        );
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to save staff profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title={staff ? 'Edit Staff Profile' : 'Add Staff Member'}
      subtitle="Staff profile and role permissions"
    >
      <View style={styles.form}>
        <FVEInput
          label="STAFF MEMBER NAME *"
          value={fullName}
          onChangeText={setFullName}
          placeholder="e.g. Alex Trainer"
        />

        <FVEInput
          label={staff ? 'EMAIL ADDRESS' : 'LOGIN EMAIL *'}
          value={email}
          onChangeText={setEmail}
          placeholder="alex@gym.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!staff}
          leftIcon={<Mail size={16} color={colors.textSubtle} />}
        />

        {!staff && (
          <View style={styles.passwordWrapper}>
            <View style={styles.passwordHeader}>
              <Text style={styles.fieldLabel}>LOGIN PASSWORD *</Text>
              <TouchableOpacity
                onPress={handleGeneratePassword}
                style={styles.generateButton}
                activeOpacity={0.7}
              >
                <Sparkles size={13} color={colors.gold} />
                <Text style={styles.generateButtonText}>Auto-Generate</Text>
              </TouchableOpacity>
            </View>

            <FVEInput
              value={password}
              onChangeText={setPassword}
              placeholder="Min 6 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Lock size={16} color={colors.textSubtle} />}
              rightIcon={
                showPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )
              }
              onRightIconPress={() => setShowPassword((p) => !p)}
            />
            <Text style={styles.credentialHint}>
              Provide this password to the staff member so they can sign in independently.
            </Text>
          </View>
        )}

        <FVEInput
          label="PHONE NUMBER"
          value={phone}
          onChangeText={setPhone}
          placeholder="Contact number"
          keyboardType="phone-pad"
        />

        {/* Role selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>ASSIGNED ROLE *</Text>
          <View style={styles.rolesGrid}>
            {OWNER_MANAGED_ROLES.map((r) => {
              const isSelected = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.roleCard, isSelected && styles.selectedRoleCard]}
                >
                  <Text style={[styles.roleName, isSelected && styles.selectedRoleName]}>
                    {ROLE_DISPLAY_NAMES[r]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FVEButton
          title={staff ? 'UPDATE PROFILE' : 'CREATE STAFF ACCOUNT'}
          onPress={handleSave}
          loading={loading}
          variant="gold"
          size="lg"
          style={styles.saveButton}
        />
      </View>
    </FVEModal>
  );
}

const getStaffFormStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    form: {
      paddingBottom: 20,
    },
    fieldSection: {
      marginBottom: 16,
    },
    passwordWrapper: {
      marginBottom: 8,
    },
    passwordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    generateButtonText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    credentialHint: {
      color: colors.textSubtle,
      fontSize: typography.sizes.xs - 1,
      fontFamily: typography.fonts.inter,
      marginTop: -8,
      marginBottom: 14,
      marginLeft: 4,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhaniMedium,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    rolesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    roleCard: {
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
    },
    selectedRoleCard: {
      backgroundColor: isDark ? colors.goldMuted : 'rgba(239, 161, 0, 0.15)',
      borderColor: colors.gold,
    },
    roleName: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    selectedRoleName: {
      color: colors.gold,
    },
    saveButton: {
      marginTop: 10,
    },
  });
