import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Upload,
  Calendar,
  Trash2,
} from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEInput } from '@/components/common/FVEInput';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEDatePickerModal } from '@/components/common/FVEDatePickerModal';
import { Member, BLOOD_GROUPS } from '@/types';
import { supabase } from '@/api/supabase';
import { getLocalDateStr, calculateAge, formatDate } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface MemberFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  member?: Member | null;
}

const GENDERS = ['Male', 'Female', 'Other'] as const;

export function MemberFormModal({
  visible,
  onClose,
  onSaved,
  member,
}: MemberFormModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form refs — uncontrolled to prevent re-render-driven focus loss
  const fullNameRef = useRef('');
  const memberIdRef = useRef('');
  const mobileRef = useRef('');
  const emailRef = useRef('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const ageRef = useRef('');
  const [gender, setGender] = useState<string>('Male');
  const [joiningDate, setJoiningDate] = useState(getLocalDateStr());
  const heightRef = useRef('');
  const weightRef = useRef('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');
  const emergencyContactRef = useRef('');
  const notesRef = useRef('');
  const [profilePhoto, setProfilePhoto] = useState('');

  // Date picker modals
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showJoiningPicker, setShowJoiningPicker] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (member) {
      fullNameRef.current = member.full_name || '';
      memberIdRef.current = member.member_id || '';
      mobileRef.current = member.mobile || '';
      emailRef.current = member.email || '';
      setDateOfBirth(member.date_of_birth || '');
      ageRef.current = member.age ? String(member.age) : '';
      setGender(member.gender || 'Male');
      setJoiningDate(member.joining_date || getLocalDateStr());
      heightRef.current = member.height || '';
      weightRef.current = member.weight || '';
      setBloodGroup(member.blood_group || '');
      setAddress(member.address || '');
      emergencyContactRef.current = member.emergency_contact || '';
      notesRef.current = member.notes || '';
      setProfilePhoto(member.profile_photo || '');
    } else {
      fullNameRef.current = '';
      memberIdRef.current = '';
      mobileRef.current = '';
      emailRef.current = '';
      setDateOfBirth('');
      ageRef.current = '';
      setGender('Male');
      setJoiningDate(getLocalDateStr());
      heightRef.current = '';
      weightRef.current = '';
      setBloodGroup('');
      setAddress('');
      emergencyContactRef.current = '';
      notesRef.current = '';
      setProfilePhoto('');
    }
    setErrors({});
  }, [member, visible]);

  // Upload image to Supabase Storage
  const uploadImageToSupabase = async (uri: string) => {
    setUploading(true);
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `members/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('member-images')
        .upload(fileName, blob, { contentType: `image/${fileExt}` });

      if (error) {
        // Fallback: keep local image URI so the user still has their photo
        setProfilePhoto(uri);
        haptics.warning();
      } else {
        const { data } = supabase.storage.from('member-images').getPublicUrl(fileName);
        setProfilePhoto(data.publicUrl);
        haptics.success();
      }
    } catch {
      // Fallback
      setProfilePhoto(uri);
    } finally {
      setUploading(false);
    }
  };

  // Camera Capture
  const handleCapturePhoto = async () => {
    haptics.medium();
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission',
          'FitVerse Elite requires camera access to capture member profile photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await uploadImageToSupabase(result.assets[0].uri);
      }
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to open camera');
    }
  };

  // Photo Gallery Upload
  const handleUploadPhoto = async () => {
    haptics.light();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await uploadImageToSupabase(result.assets[0].uri);
      }
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to select image from gallery');
    }
  };

  const handleDobSelect = (dateStr: string) => {
    setDateOfBirth(dateStr);
    const computed = calculateAge(dateStr);
    if (computed !== null && computed >= 0) {
      ageRef.current = String(computed);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullNameRef.current.trim() || fullNameRef.current.trim().length < 2) {
      errs.fullName = 'Full name must be at least 2 characters';
    }
    const cleanMobile = mobileRef.current.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      errs.mobile = 'Enter a valid 10-digit mobile number';
    }
    if (!gender) {
      errs.gender = 'Please select a gender';
    }
    if (!address.trim() && !notesRef.current) {
      errs.address = 'Residential address is required';
    }
    if (!joiningDate.trim()) {
      errs.joiningDate = 'Joining date is required (YYYY-MM-DD)';
    }
    if (heightRef.current && (isNaN(Number(heightRef.current)) || Number(heightRef.current) < 50 || Number(heightRef.current) > 300)) {
      errs.height = 'Height must be between 50 and 300 cm';
    }
    if (weightRef.current && (isNaN(Number(weightRef.current)) || Number(weightRef.current) < 10 || Number(weightRef.current) > 500)) {
      errs.weight = 'Weight must be between 10 and 500 kg';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      haptics.warning();
      return;
    }
    setLoading(true);

    try {
      const calculatedAge = dateOfBirth.trim()
        ? calculateAge(dateOfBirth.trim())
        : (ageRef.current ? parseInt(ageRef.current, 10) : null);

      const payload = {
        full_name: fullNameRef.current.trim(),
        member_id: memberIdRef.current.trim() || null,
        mobile: mobileRef.current.trim() || null,
        email: emailRef.current.trim().toLowerCase() || null,
        date_of_birth: dateOfBirth.trim() || null,
        age: calculatedAge ?? null,
        gender,
        joining_date: joiningDate.trim() || getLocalDateStr(),
        height: heightRef.current.trim() || null,
        weight: weightRef.current.trim() || null,
        blood_group: bloodGroup.trim() || null,
        address: address.trim(),
        emergency_contact: emergencyContactRef.current.trim() || null,
        notes: notesRef.current.trim() || null,
        profile_photo: profilePhoto.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (member) {
        const { error } = await supabase
          .from('members')
          .update(payload)
          .eq('id', member.id);

        if (error) throw error;
        haptics.success();
        Alert.alert('Success', `${fullNameRef.current} updated successfully!`);
      } else {
        const randomQR = `FVE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const { error } = await supabase.from('members').insert({
          ...payload,
          qr_code: randomQR,
          created_by: user?.id || null,
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
        haptics.success();
        Alert.alert('Success', `${fullNameRef.current} registered to FitVerse Elite!`);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Error', (err as Error).message || 'Failed to save member details');
    } finally {
      setLoading(false);
    }
  };

  const computedAge = dateOfBirth ? calculateAge(dateOfBirth) : (ageRef.current ? parseInt(ageRef.current, 10) : null);

  return (
    <>
      <FVEModal
        visible={visible}
        onClose={onClose}
        title={member ? 'EDIT MEMBER' : 'REGISTER NEW MEMBER'}
        subtitle={member ? `ID: ${member.member_id || member.id.substring(0, 8)}` : 'Athlete Operational Roster'}
      >
        <View style={styles.form}>
          {/* ── PHOTO MEDIA & AVATAR ACTIONS ── */}
          <View style={styles.mediaCard}>
            <View style={styles.avatarContainer}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {fullNameRef.current.trim().charAt(0).toUpperCase() || 'F'}
                  </Text>
                </View>
              )}

              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color={colors.gold} size="small" />
                </View>
              )}
            </View>

            <View style={styles.mediaButtonsCol}>
              <View style={styles.mediaButtonsRow}>
                <TouchableOpacity
                  onPress={handleCapturePhoto}
                  disabled={uploading}
                  style={styles.captureBtn}
                  activeOpacity={0.8}
                >
                  <Camera size={16} color="#050505" />
                  <Text style={styles.captureBtnText}>Capture Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUploadPhoto}
                  disabled={uploading}
                  style={styles.uploadBtn}
                  activeOpacity={0.8}
                >
                  <Upload size={15} color={colors.gold} />
                  <Text style={styles.uploadBtnText}>Upload</Text>
                </TouchableOpacity>

                {profilePhoto ? (
                  <TouchableOpacity
                    onPress={() => setProfilePhoto('')}
                    style={styles.removePhotoBtn}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={15} color={colors.error} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.photoHintText}>
                {profilePhoto
                  ? 'Photo attached · Ready to save'
                  : 'Capture with camera or upload from gallery'}
              </Text>
            </View>
          </View>

          {/* ── SECTION 1: PERSONAL INFORMATION ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
          </View>

          <FVEInput
            label="FULL NAME *"
            defaultValue={fullNameRef.current}
            onChangeText={(t) => { fullNameRef.current = t; }}
            placeholder="e.g. Marcus Vance"
            error={errors.fullName}
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <FVEInput
                label="MEMBER ID (OPTIONAL)"
                defaultValue={memberIdRef.current}
                onChangeText={(t) => { memberIdRef.current = t; }}
                placeholder="e.g. FVE-101"
              />
            </View>
            <View style={[styles.flex1, { marginLeft: 10 }]}>
              {/* Interactive Joining Date Button */}
              <Text style={styles.dateFieldLabel}>JOINING DATE *</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setShowJoiningPicker(true);
                }}
                style={styles.datePickerTrigger}
                activeOpacity={0.8}
              >
                <Calendar size={15} color={colors.gold} />
                <Text style={styles.datePickerValueText}>
                  {joiningDate ? formatDate(joiningDate) : 'Select Date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <FVEInput
            label="MOBILE NUMBER *"
            defaultValue={mobileRef.current}
            onChangeText={(t) => { mobileRef.current = t; }}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            error={errors.mobile}
          />

          <FVEInput
            label="EMAIL ADDRESS"
            defaultValue={emailRef.current}
            onChangeText={(t) => { emailRef.current = t; }}
            placeholder="marcus@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Interactive Date of Birth + Auto Age */}
          <View style={styles.row}>
            <View style={[styles.flex1, { flex: 1.4 }]}>
              <Text style={styles.dateFieldLabel}>DATE OF BIRTH</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setShowDobPicker(true);
                }}
                style={styles.datePickerTrigger}
                activeOpacity={0.8}
              >
                <Calendar size={15} color={colors.gold} />
                <Text
                  style={[
                    styles.datePickerValueText,
                    !dateOfBirth && styles.datePickerPlaceholderText,
                  ]}
                >
                  {dateOfBirth ? formatDate(dateOfBirth) : 'Tap to set DOB'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.flex1, { marginLeft: 10, flex: 0.8 }]}>
              <FVEInput
                label="AGE"
                defaultValue={ageRef.current}
                onChangeText={(t) => { ageRef.current = t; }}
                placeholder="e.g. 28"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {computedAge !== null && (
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeText}>Calculated Age: {computedAge} years old</Text>
            </View>
          )}

          {/* Gender Chips */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>GENDER *</Text>
            <View style={styles.chipsRow}>
              {GENDERS.map((g) => {
                const selected = gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => {
                      haptics.selection();
                      setGender(g);
                    }}
                    style={[styles.genderChip, selected && styles.genderChipSelected]}
                  >
                    <Text style={[styles.genderChipText, selected && styles.genderChipTextSelected]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── SECTION 2: BODY STATS & HEALTH ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>BODY STATS & HEALTH</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <FVEInput
                label="HEIGHT (CM)"
                defaultValue={heightRef.current}
                onChangeText={(t) => { heightRef.current = t; }}
                placeholder="178"
                keyboardType="number-pad"
                error={errors.height}
              />
            </View>
            <View style={[styles.flex1, { marginLeft: 10 }]}>
              <FVEInput
                label="WEIGHT (KG)"
                defaultValue={weightRef.current}
                onChangeText={(t) => { weightRef.current = t; }}
                placeholder="75.5"
                keyboardType="numeric"
                error={errors.weight}
              />
            </View>
          </View>

          {/* Blood Group Chips */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>BLOOD GROUP</Text>
            <View style={styles.chipsRow}>
              {BLOOD_GROUPS.map((bg) => {
                const selected = bloodGroup === bg;
                return (
                  <TouchableOpacity
                    key={bg}
                    onPress={() => {
                      haptics.selection();
                      setBloodGroup(selected ? '' : bg);
                    }}
                    style={[styles.bgChip, selected && styles.bgChipSelected]}
                  >
                    <Text style={[styles.bgChipText, selected && styles.bgChipTextSelected]}>
                      {bg}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── SECTION 3: RESIDENTIAL & CONTACT ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>RESIDENTIAL & CONTACT</Text>
          </View>

          <FVEInput
            label="RESIDENTIAL ADDRESS *"
            value={address}
            onChangeText={setAddress}
            placeholder="Complete street, apartment or locality..."
            multiline
            numberOfLines={3}
            style={styles.multilineInput}
            error={errors.address}
          />

          <FVEInput
            label="EMERGENCY CONTACT PHONE"
            defaultValue={emergencyContactRef.current}
            onChangeText={(t) => { emergencyContactRef.current = t; }}
            placeholder="+91 98765 00000"
            keyboardType="phone-pad"
          />

          <FVEInput
            label="TRAINER / MEDICAL NOTES"
            defaultValue={notesRef.current}
            onChangeText={(t) => { notesRef.current = t; }}
            placeholder="Fitness goals, health conditions, or personal training notes..."
            multiline
            numberOfLines={3}
            style={styles.multilineInput}
          />

          <FVEButton
            title={member ? 'UPDATE ATHLETE RECORD' : 'SAVE & REGISTER MEMBER'}
            onPress={handleSave}
            loading={loading}
            variant="gold"
            size="lg"
            style={styles.submitBtn}
          />
        </View>
      </FVEModal>

      {/* Date of Birth Picker */}
      <FVEDatePickerModal
        visible={showDobPicker}
        onClose={() => setShowDobPicker(false)}
        onSelectDate={handleDobSelect}
        initialDate={dateOfBirth || '1998-01-01'}
        title="SELECT DATE OF BIRTH"
      />

      {/* Joining Date Picker */}
      <FVEDatePickerModal
        visible={showJoiningPicker}
        onClose={() => setShowJoiningPicker(false)}
        onSelectDate={(d) => setJoiningDate(d)}
        initialDate={joiningDate || getLocalDateStr()}
        title="SELECT JOINING DATE"
      />
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingBottom: 20,
  },
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: 'hidden',
    backgroundColor: '#151920',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151920',
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 26,
    fontFamily: typography.fonts.orbitron,
    fontWeight: '700',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaButtonsCol: {
    flex: 1,
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  captureBtnText: {
    color: '#050505',
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161A22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  uploadBtnText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  removePhotoBtn: {
    padding: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHintText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
  },
  dateFieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhaniMedium,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 16,
  },
  datePickerValueText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.inter,
    fontWeight: '500',
  },
  datePickerPlaceholderText: {
    color: colors.textSubtle,
  },
  ageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 161, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
    marginTop: -8,
  },
  ageBadgeText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhaniMedium,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  genderChipSelected: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  genderChipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  genderChipTextSelected: {
    color: colors.gold,
  },
  bgChip: {
    width: 44,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#11141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgChipSelected: {
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  bgChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '700',
  },
  bgChipTextSelected: {
    color: colors.gold,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtn: {
    marginTop: 10,
    marginBottom: 10,
  },
});
