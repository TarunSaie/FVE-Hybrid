import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
} from 'react-native';
import {
  MessageCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  X,
  Phone,
  Calendar,
  Clock,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Edit3,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useBranding } from '@/contexts/BrandingContext';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';
import { formatDate } from '@/utils/date';
import { openWhatsAppLink } from '@/utils/format';

export interface ExpiringQueueItem {
  id: string;
  memberId: string;
  memberName: string;
  memberMobile: string;
  planName: string;
  expiryDate: string;
  daysLeft: number;
  message: string;
}

interface WhatsAppQueueModalProps {
  visible: boolean;
  onClose: () => void;
  queue: ExpiringQueueItem[];
  onMemberSent?: (item: ExpiringQueueItem) => void;
  batchInfo?: {
    batchSize: number | string;
    totalPending: number;
    remainingAfterBatch?: number;
  };
  onProceedNextBatch?: () => void;
}

export function WhatsAppQueueModal({
  visible,
  onClose,
  queue,
  onMemberSent,
  batchInfo,
  onProceedNextBatch,
}: WhatsAppQueueModalProps) {
  const { colors, isDark } = useTheme();
  const { brandConfig } = useBranding();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [skippedMap, setSkippedMap] = useState<Record<string, boolean>>({});
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const primaryAccent = brandConfig.primary_color || colors.gold;

  if (!visible || queue.length === 0) return null;

  const total = queue.length;
  const isCompleted = currentIndex >= total;
  const currentMember = !isCompleted ? queue[currentIndex] : null;

  const currentMessage = currentMember
    ? (editedMessages[currentMember.id] ?? currentMember.message)
    : '';

  const isCustomized = Boolean(
    currentMember &&
      editedMessages[currentMember.id] !== undefined &&
      editedMessages[currentMember.id] !== currentMember.message
  );

  const sentCount = Object.values(sentMap).filter(Boolean).length;
  const skippedCount = Object.values(skippedMap).filter(Boolean).length;
  const progressPercent = Math.round(((sentCount + skippedCount) / total) * 100);

  const handleMessageChange = (newText: string) => {
    if (!currentMember) return;
    setEditedMessages((prev) => ({ ...prev, [currentMember.id]: newText }));
  };

  const handleResetMessage = () => {
    if (!currentMember) return;
    haptics.light();
    setEditedMessages((prev) => {
      const next = { ...prev };
      delete next[currentMember.id];
      return next;
    });
  };

  const handleSendCurrent = async () => {
    if (!currentMember) return;
    haptics.medium();

    // Mark current as sent in modal state
    setSentMap((prev) => ({ ...prev, [currentMember.id]: true }));

    // Notify parent to record member as processed in persistent store with current message
    onMemberSent?.({
      ...currentMember,
      message: currentMessage,
    });

    // Open native WhatsApp app with active (possibly edited) message
    await openWhatsAppLink(currentMember.memberMobile, currentMessage);

    // Auto-advance to next member in queue
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSkipCurrent = () => {
    if (!currentMember) return;
    haptics.light();
    setSkippedMap((prev) => ({ ...prev, [currentMember.id]: true }));
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      haptics.light();
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleCopyMessage = async () => {
    if (!currentMember) return;
    await Clipboard.setStringAsync(currentMessage);
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetQueue = () => {
    haptics.medium();
    setCurrentIndex(0);
    setSentMap({});
    setSkippedMap({});
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View
            style={[
              styles.container,
              {
                backgroundColor: isDark ? '#0D0D10' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerLeft}>
                <LinearGradient
                  colors={['#25D366', '#128C7E']}
                  style={styles.headerIconContainer}
                >
                  <MessageCircle size={22} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.titleText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      WhatsApp Fast-Queue
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: 'rgba(37, 211, 102, 0.15)',
                          borderColor: 'rgba(37, 211, 102, 0.3)',
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>Assisted</Text>
                    </View>
                  </View>
                  <Text style={[styles.subTitleText, { color: colors.textSecondary }]}>
                    Sequential 1-tap expiry reminders
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.surfaceLight }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Progress Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressTextRow}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {isCompleted
                    ? 'Queue Completed'
                    : `Member ${currentIndex + 1} of ${total}`}
                </Text>
                <Text style={[styles.progressCount, { color: colors.textPrimary }]}>
                  {progressPercent}% • {sentCount} Sent
                  {skippedCount > 0 ? `, ${skippedCount} Skipped` : ''}
                </Text>
              </View>

              <View
                style={[
                  styles.progressBarBackground,
                  { backgroundColor: colors.surfaceLight },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: '#25D366',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Main Content */}
            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollInner}
              showsVerticalScrollIndicator={false}
            >
              {!isCompleted && currentMember ? (
                <>
                  {/* Member Card */}
                  <View
                    style={[
                      styles.memberCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.memberCardTop}>
                      <View style={styles.memberDetails}>
                        <Text
                          style={[
                            styles.memberName,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {currentMember.memberName}
                        </Text>
                        <View style={styles.phoneRow}>
                          <Phone size={13} color="#25D366" />
                          <Text
                            style={[
                              styles.phoneText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {currentMember.memberMobile}
                          </Text>
                        </View>
                      </View>

                      {/* Expiry Pill */}
                      <View
                        style={[
                          styles.expiryPill,
                          {
                            backgroundColor:
                              currentMember.daysLeft <= 1
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(239, 161, 0, 0.15)',
                            borderColor:
                              currentMember.daysLeft <= 1
                                ? 'rgba(239, 68, 68, 0.35)'
                                : 'rgba(239, 161, 0, 0.35)',
                          },
                        ]}
                      >
                        <Clock
                          size={11}
                          color={
                            currentMember.daysLeft <= 1 ? '#EF4444' : primaryAccent
                          }
                        />
                        <Text
                          style={[
                            styles.expiryPillText,
                            {
                              color:
                                currentMember.daysLeft <= 1
                                  ? '#EF4444'
                                  : primaryAccent,
                            },
                          ]}
                        >
                          {currentMember.daysLeft <= 0
                            ? 'Today'
                            : currentMember.daysLeft === 1
                            ? 'Tomorrow'
                            : `${currentMember.daysLeft}d left`}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.memberMetaRow,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <View style={styles.metaCol}>
                        <Text
                          style={[styles.metaLabel, { color: colors.textMuted }]}
                        >
                          PLAN
                        </Text>
                        <Text
                          style={[styles.metaValue, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {currentMember.planName}
                        </Text>
                      </View>
                      <View style={styles.metaCol}>
                        <Text
                          style={[styles.metaLabel, { color: colors.textMuted }]}
                        >
                          EXPIRY DATE
                        </Text>
                        <Text
                          style={[styles.metaValue, { color: colors.textPrimary }]}
                        >
                          {formatDate(currentMember.expiryDate)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Message Bubble Preview & Editor */}
                  <View style={styles.messagePreviewSection}>
                    <View style={styles.messageHeaderRow}>
                      <View style={styles.previewTitleRow}>
                        <Sparkles size={13} color={primaryAccent} />
                        <Text
                          style={[
                            styles.previewTitle,
                            { color: colors.textSecondary },
                          ]}
                        >
                          WhatsApp Message
                        </Text>
                        {isCustomized ? (
                          <View style={styles.customizedBadge}>
                            <Edit3 size={9} color={colors.warning} />
                            <Text style={styles.customizedBadgeText}>Customized</Text>
                          </View>
                        ) : (
                          <View style={styles.editableBadge}>
                            <Text style={styles.editableBadgeText}>Editable</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.headerRightControls}>
                        {isCustomized && (
                          <TouchableOpacity
                            onPress={handleResetMessage}
                            style={styles.resetButton}
                            activeOpacity={0.7}
                          >
                            <RotateCcw size={11} color={colors.warning} />
                            <Text style={styles.resetButtonText}>Reset</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={handleCopyMessage}
                          style={styles.copyButton}
                          activeOpacity={0.7}
                        >
                          {copied ? (
                            <>
                              <Check size={12} color="#25D366" />
                              <Text style={styles.copiedText}>Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color={colors.textMuted} />
                              <Text
                                style={[
                                  styles.copyButtonText,
                                  { color: colors.textMuted },
                                ]}
                              >
                                Copy
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.messageBubble,
                        {
                          backgroundColor: isDark
                            ? 'rgba(37, 211, 102, 0.08)'
                            : 'rgba(37, 211, 102, 0.1)',
                          borderColor: isCustomized
                            ? 'rgba(239, 161, 0, 0.4)'
                            : 'rgba(37, 211, 102, 0.3)',
                        },
                      ]}
                    >
                      <TextInput
                        multiline
                        value={currentMessage}
                        onChangeText={handleMessageChange}
                        style={[
                          styles.messageInput,
                          { color: isDark ? '#D1FAE5' : '#065F46' },
                        ]}
                        placeholder="Enter message..."
                        placeholderTextColor={isDark ? '#065F46' : '#A7F3D0'}
                      />
                      <View style={styles.messageFooterRow}>
                        <Text style={styles.messageFooterText}>
                          ✏️ Tap inside to edit before sending
                        </Text>
                        <Text style={styles.charCountText}>
                          {currentMessage.length} chars
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      onPress={handleSendCurrent}
                      activeOpacity={0.85}
                      style={styles.sendButtonTouch}
                    >
                      <LinearGradient
                        colors={['#25D366', '#128C7E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sendButtonGradient}
                      >
                        <MessageCircle size={20} color="#FFFFFF" />
                        <Text style={styles.sendButtonText}>
                          Send to {currentMember.memberName.split(' ')[0]}
                        </Text>
                        <ChevronRight size={20} color="#FFFFFF" />
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.secondaryControlsRow}>
                      <TouchableOpacity
                        onPress={handlePrevious}
                        disabled={currentIndex === 0}
                        style={[
                          styles.secondaryButton,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            opacity: currentIndex === 0 ? 0.35 : 1,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <ChevronLeft size={16} color={colors.textSecondary} />
                        <Text
                          style={[
                            styles.secondaryButtonText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Previous
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSkipCurrent}
                        style={[
                          styles.secondaryButton,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.secondaryButtonText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Skip
                        </Text>
                        <SkipForward size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                /* Completion View */
                <View style={styles.completionContainer}>
                  <View
                    style={[
                      styles.completionIconCircle,
                      {
                        backgroundColor: 'rgba(37, 211, 102, 0.15)',
                        borderColor: 'rgba(37, 211, 102, 0.3)',
                      },
                    ]}
                  >
                    <CheckCircle2 size={44} color="#25D366" />
                  </View>

                  <Text
                    style={[
                      styles.completionTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Queue Finished!
                  </Text>
                  <Text
                    style={[
                      styles.completionSub,
                      { color: colors.textSecondary },
                    ]}
                  >
                    All eligible members in the expiry queue have been processed.
                  </Text>

                  <View
                    style={[
                      styles.summaryBox,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryNumber, { color: '#25D366' }]}>
                        {sentCount}
                      </Text>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        Dispatched
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.summaryDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryNumber, { color: primaryAccent }]}>
                        {skippedCount}
                      </Text>
                      <Text
                        style={[
                          styles.summaryLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        Skipped
                      </Text>
                    </View>
                  </View>

                  {batchInfo && typeof batchInfo.remainingAfterBatch === 'number' && batchInfo.remainingAfterBatch > 0 ? (
                    <View
                      style={[
                        styles.batchRemainingBanner,
                        {
                          backgroundColor: 'rgba(239, 161, 0, 0.1)',
                          borderColor: 'rgba(239, 161, 0, 0.3)',
                        },
                      ]}
                    >
                      <Text style={[styles.batchRemainingTitle, { color: primaryAccent }]}>
                        {batchInfo.remainingAfterBatch} more unsent member{batchInfo.remainingAfterBatch > 1 ? 's' : ''} in queue
                      </Text>
                      <Text style={[styles.batchRemainingSub, { color: colors.textSecondary }]}>
                        Remaining unsent members are now prioritized at the top.
                      </Text>
                    </View>
                  ) : null}

                  {onProceedNextBatch && batchInfo && typeof batchInfo.remainingAfterBatch === 'number' && batchInfo.remainingAfterBatch > 0 ? (
                    <TouchableOpacity
                      onPress={onProceedNextBatch}
                      style={[styles.nextBatchBtn, { backgroundColor: primaryAccent }]}
                      activeOpacity={0.8}
                    >
                      <MessageCircle size={16} color="#050505" />
                      <Text style={styles.nextBatchBtnText}>
                        Send Next Batch ({Math.min(Number(batchInfo.batchSize) || 30, batchInfo.remainingAfterBatch)})
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.completionButtonsRow}>
                    <TouchableOpacity
                      onPress={handleResetQueue}
                      style={[
                        styles.restartButton,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={15} color={colors.textSecondary} />
                      <Text
                        style={[
                          styles.restartButtonText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Replay
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={onClose}
                      style={[
                        styles.doneButton,
                        { backgroundColor: colors.surfaceLight },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.doneButtonText, { color: colors.textPrimary }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                {brandConfig.gym_name || 'FitVerse Elite'} • Zero Meta API Costs
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.footerCloseLink, { color: primaryAccent }]}>
                  Close
                </Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeArea: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 17,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: typography.fonts.interSemiBold,
    fontSize: 10,
    color: '#25D366',
    textTransform: 'uppercase',
  },
  subTitleText: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: typography.fonts.interSemiBold,
    fontSize: 12,
  },
  progressCount: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 11,
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollInner: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  memberCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  memberCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberDetails: {
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 18,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  phoneText: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 12,
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  expiryPillText: {
    fontFamily: typography.fonts.interSemiBold,
    fontSize: 11,
  },
  memberMetaRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: typography.fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 12,
  },
  messagePreviewSection: {
    marginTop: 14,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewTitle: {
    fontFamily: typography.fonts.interSemiBold,
    fontSize: 11,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copyButtonText: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
  },
  copiedText: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 11,
    color: '#25D366',
  },
  messageBubble: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageInput: {
    fontFamily: typography.fonts.inter,
    fontSize: 12,
    lineHeight: 18,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 0,
  },
  messageFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(37, 211, 102, 0.15)',
  },
  messageFooterText: {
    fontFamily: typography.fonts.inter,
    fontSize: 10,
    color: 'rgba(37, 211, 102, 0.8)',
  },
  charCountText: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 10,
    color: 'rgba(37, 211, 102, 0.8)',
  },
  customizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 161, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 161, 0, 0.35)',
  },
  customizedBadgeText: {
    fontSize: 9.5,
    fontFamily: typography.fonts.interSemiBold,
    color: '#EFA100',
  },
  editableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.25)',
  },
  editableBadgeText: {
    fontSize: 9.5,
    fontFamily: typography.fonts.interMedium,
    color: '#25D366',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetButtonText: {
    fontSize: 11,
    fontFamily: typography.fonts.interMedium,
    color: '#EFA100',
  },
  messageText: {
    fontFamily: typography.fonts.inter,
    fontSize: 12,
    lineHeight: 18,
  },
  actionsContainer: {
    marginTop: 16,
    gap: 10,
  },
  sendButtonTouch: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.rajdhani,
    fontSize: 16,
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  secondaryButtonText: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 12,
  },
  completionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  completionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  completionTitle: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 22,
    marginBottom: 4,
  },
  completionSub: {
    fontFamily: typography.fonts.inter,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    marginBottom: 16,
  },
  summaryBox: {
    flexDirection: 'row',
    width: 240,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: '100%',
  },
  summaryNumber: {
    fontFamily: typography.fonts.rajdhani,
    fontSize: 22,
  },
  summaryLabel: {
    fontFamily: typography.fonts.inter,
    fontSize: 10,
    marginTop: 2,
  },
  completionButtonsRow: {
    flexDirection: 'row',
    width: 240,
    gap: 10,
  },
  restartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  restartButtonText: {
    fontFamily: typography.fonts.interMedium,
    fontSize: 12,
  },
  doneButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneButtonText: {
    color: '#050505',
    fontFamily: typography.fonts.interBold,
    fontSize: 12,
  },
  batchRemainingBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  batchRemainingTitle: {
    fontFamily: typography.fonts.interBold,
    fontSize: 13,
    marginBottom: 3,
  },
  batchRemainingSub: {
    fontFamily: typography.fonts.inter,
    fontSize: 11,
    textAlign: 'center',
  },
  nextBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
  },
  nextBatchBtnText: {
    color: '#050505',
    fontFamily: typography.fonts.rajdhani,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerText: {
    fontFamily: typography.fonts.inter,
    fontSize: 10,
  },
  footerCloseLink: {
    fontFamily: typography.fonts.interSemiBold,
    fontSize: 11,
  },
});
