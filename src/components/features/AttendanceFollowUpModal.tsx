import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  Edit3,
  Phone,
  AlertTriangle,
  UserX,
  Clock,
} from 'lucide-react-native';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEButton } from '@/components/common/FVEButton';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { openWhatsAppLink } from '@/utils/format';
import { formatDate } from '@/utils/date';
import {
  ATTENDANCE_TEMPLATES,
  resolveAttendanceMessage,
  AttendanceMessageTemplate,
} from '@/utils/attendanceMessaging';

interface AttendanceFollowUpModalProps {
  visible: boolean;
  onClose: () => void;
  member: {
    id: string;
    full_name: string;
    member_id?: string | null;
    mobile?: string | null;
    profile_photo?: string | null;
  } | null;
  attendanceInfo?: {
    checkedInToday: boolean;
    consecutiveAbsentDays: number;
    lastCheckInDate?: string | null;
  } | null;
}

export function AttendanceFollowUpModal({
  visible,
  onClose,
  member,
  attendanceInfo,
}: AttendanceFollowUpModalProps) {
  const [mode, setMode] = useState<'PREDEFINED' | 'CUSTOM'>('PREDEFINED');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('daily_miss');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [editablePredefined, setEditablePredefined] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const daysAbsent = attendanceInfo?.consecutiveAbsentDays || 1;
  const isContinuous = daysAbsent >= 3;

  useEffect(() => {
    if (visible && member) {
      const defaultId = isContinuous ? 'continuous_absence' : 'daily_miss';
      setSelectedTemplateId(defaultId);
      const chosen =
        ATTENDANCE_TEMPLATES.find((t) => t.id === defaultId) || ATTENDANCE_TEMPLATES[0];
      setEditablePredefined(
        resolveAttendanceMessage(chosen.template, member.full_name, daysAbsent)
      );
      setCustomMessage(
        resolveAttendanceMessage(
          'Hi {name}, greetings from FitVerse Elite! We noticed you missed your workout today. Hope everything is alright!',
          member.full_name,
          daysAbsent
        )
      );
      setCopied(false);
    }
  }, [visible, member, isContinuous, daysAbsent]);

  if (!member) return null;

  const handleTemplateSelect = (template: AttendanceMessageTemplate) => {
    haptics.selection();
    setSelectedTemplateId(template.id);
    setEditablePredefined(
      resolveAttendanceMessage(template.template, member.full_name, daysAbsent)
    );
  };

  const finalMessage = mode === 'PREDEFINED' ? editablePredefined : customMessage;

  const handleSendWhatsApp = async () => {
    if (!member.mobile) {
      haptics.error();
      Alert.alert(
        'No Mobile Number',
        'This member does not have a registered mobile number for WhatsApp messaging.'
      );
      return;
    }
    if (!finalMessage.trim()) {
      haptics.warning();
      Alert.alert('Empty Message', 'Please enter or select a follow-up message.');
      return;
    }

    haptics.medium();
    await openWhatsAppLink(member.mobile, finalMessage.trim());
    onClose();
  };

  const handleCopyMessage = async () => {
    if (!finalMessage.trim()) return;
    haptics.light();
    await Clipboard.setStringAsync(finalMessage.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCall = () => {
    if (member.mobile) {
      haptics.light();
      Linking.openURL(`tel:${member.mobile}`);
    }
  };

  return (
    <FVEModal
      visible={visible}
      onClose={onClose}
      title="FOLLOW-UP MESSAGE"
      subtitle={`Member: ${member.full_name}${member.mobile ? ` (${member.mobile})` : ''}`}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Absence Status Badge Box */}
        <View
          style={[
            styles.statusCard,
            isContinuous ? styles.statusCardAlert : styles.statusCardAbsent,
          ]}
        >
          <View style={styles.statusCardLeft}>
            {isContinuous ? (
              <AlertTriangle size={16} color="#EF4444" />
            ) : (
              <UserX size={16} color="#F59E0B" />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.statusTitle,
                  { color: isContinuous ? '#EF4444' : '#F59E0B' },
                ]}
              >
                {isContinuous
                  ? `Continuous Absence: ${daysAbsent} Days Absent`
                  : 'Absent Today'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {attendanceInfo?.lastCheckInDate
                  ? `Last check-in on ${formatDate(attendanceInfo.lastCheckInDate)}`
                  : 'No prior attendance recorded'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: isContinuous ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)' },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isContinuous ? '#FCA5A5' : '#FCD34D' },
              ]}
            >
              {isContinuous ? `${daysAbsent}D ALERT` : 'ABSENT'}
            </Text>
          </View>
        </View>

        {/* Mode Segment Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setMode('PREDEFINED');
            }}
            style={[styles.tabButton, mode === 'PREDEFINED' && styles.tabButtonActive]}
          >
            <Sparkles
              size={13}
              color={mode === 'PREDEFINED' ? colors.gold : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                mode === 'PREDEFINED' && styles.tabTextActive,
              ]}
            >
              Predefined Message
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setMode('CUSTOM');
            }}
            style={[styles.tabButton, mode === 'CUSTOM' && styles.tabButtonActive]}
          >
            <Edit3
              size={13}
              color={mode === 'CUSTOM' ? colors.gold : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                mode === 'CUSTOM' && styles.tabTextActive,
              ]}
            >
              Custom Message
            </Text>
          </TouchableOpacity>
        </View>

        {/* Predefined Mode */}
        {mode === 'PREDEFINED' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SELECT TEMPLATE</Text>
            <View style={styles.templateList}>
              {ATTENDANCE_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <TouchableOpacity
                    key={tmpl.id}
                    onPress={() => handleTemplateSelect(tmpl)}
                    style={[
                      styles.templateCard,
                      isSelected && styles.templateCardSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.templateCardHeader}>
                      <Text
                        style={[
                          styles.templateTitle,
                          isSelected && { color: colors.gold },
                        ]}
                      >
                        {tmpl.title}
                      </Text>
                      {tmpl.id === 'continuous_absence' && isContinuous && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>Recommended</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={2} style={styles.templateSnippet}>
                      {resolveAttendanceMessage(tmpl.template, member.full_name, daysAbsent)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Editable Preview */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>MESSAGE PREVIEW (EDITABLE)</Text>
            <TextInput
              value={editablePredefined}
              onChangeText={setEditablePredefined}
              multiline
              numberOfLines={4}
              style={styles.messageInput}
              placeholder="Review message..."
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ) : (
          /* Custom Mode */
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TYPE PERSONALIZED MESSAGE</Text>
            <TextInput
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
              numberOfLines={6}
              style={[styles.messageInput, { minHeight: 110 }]}
              placeholder={`Write a friendly follow-up message for ${member.full_name}...`}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.customHint}>
              Personal encouragement reinforces member retention and dedication.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleCopyMessage}
            style={styles.copyButton}
            activeOpacity={0.8}
          >
            {copied ? (
              <Check size={14} color={colors.success} />
            ) : (
              <Copy size={14} color={colors.textSecondary} />
            )}
            <Text
              style={[
                styles.copyButtonText,
                copied && { color: colors.success },
              ]}
            >
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          {member.mobile && (
            <TouchableOpacity
              onPress={handleCall}
              style={styles.callButton}
              activeOpacity={0.8}
            >
              <Phone size={14} color={colors.gold} />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSendWhatsApp}
            disabled={!member.mobile}
            style={[styles.whatsappButton, !member.mobile && { opacity: 0.5 }]}
            activeOpacity={0.85}
          >
            <MessageCircle size={15} color="#FFFFFF" />
            <Text style={styles.whatsappButtonText}>Send WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FVEModal>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  statusCardAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusCardAbsent: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  tabText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
  },
  tabTextActive: {
    color: colors.gold,
    fontWeight: '600',
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  templateList: {
    gap: 8,
  },
  templateCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  templateCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(239, 161, 0, 0.08)',
  },
  templateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  templateTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F87171',
  },
  templateSnippet: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  messageInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  customHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 161, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.3)',
  },
  callButtonText: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '600',
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#25D366',
  },
  whatsappButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: typography.fonts.rajdhani,
    letterSpacing: 0.5,
  },
});
