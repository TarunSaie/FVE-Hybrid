import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { UserProfile, UserRole } from '@/types';
import { supabase } from '@/api/supabase';
import { OWNER_MANAGED_ROLES, ROLE_DISPLAY_NAMES } from '@/constants/permissions';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

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
  const [loading, setLoading] = useState(false);
  const fullNameRef = useRef('');
  const emailRef = useRef('');
  const phoneRef = useRef('');
  const [role, setRole] = useState<UserRole>('RECEPTIONIST');

  useEffect(() => {
    if (staff) {
      fullNameRef.current = staff.full_name || '';
      emailRef.current = staff.email || '';
      phoneRef.current = staff.phone || '';
      setRole((staff.role as UserRole) || 'RECEPTIONIST');
    } else {
      fullNameRef.current = '';
      emailRef.current = '';
      phoneRef.current = '';
      setRole('RECEPTIONIST');
    }
  }, [staff, visible]);

  const handleSave = async () => {
    if (!fullNameRef.current.trim()) return Alert.alert('Error', 'Full name is required');

    setLoading(true);
    try {
      const username = emailRef.current.trim()
        ? emailRef.current.trim().toLowerCase().split('@')[0]
        : fullNameRef.current.trim().toLowerCase().replace(/\s+/g, '.');

      if (staff) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: fullNameRef.current.trim(),
            email: emailRef.current.trim().toLowerCase() || null,
            phone: phoneRef.current.trim() || null,
            role,
            username,
          })
          .eq('id', staff.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_profiles')
          .insert({
            full_name: fullNameRef.current.trim(),
            email: emailRef.current.trim().toLowerCase() || null,
            phone: phoneRef.current.trim() || null,
            role,
            username,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
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
          defaultValue={fullNameRef.current}
          onChangeText={(t) => { fullNameRef.current = t; }}
          placeholder="e.g. Alex Trainer"
        />

        <FVEInput
          label="EMAIL ADDRESS"
          defaultValue={emailRef.current}
          onChangeText={(t) => { emailRef.current = t; }}
          placeholder="alex@fitverse.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <FVEInput
          label="PHONE NUMBER"
          defaultValue={phoneRef.current}
          onChangeText={(t) => { phoneRef.current = t; }}
          placeholder="Contact number"
          keyboardType="phone-pad"
        />

        {/* Role selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>ASSIGNED ROLE *</Text>
          <View style={styles.rolesGrid}>
            {OWNER_MANAGED_ROLES.map(r => {
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
          title={staff ? 'UPDATE PROFILE' : 'CREATE STAFF'}
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

const styles = StyleSheet.create({
  form: {
    paddingBottom: 20,
  },
  fieldSection: {
    marginBottom: 16,
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
    backgroundColor: '#161A20',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  selectedRoleCard: {
    backgroundColor: colors.goldMuted,
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
