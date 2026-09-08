import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Dumbbell,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ChevronRight,
  Search,
  AlertCircle,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEBadge } from '@/components/common/FVEBadge';
import { FVEButton } from '@/components/common/FVEButton';
import { FVEInput } from '@/components/common/FVEInput';
import { PTAssignmentModal } from '@/components/features/PTAssignmentModal';
import { PTPaymentModal } from '@/components/features/PTPaymentModal';
import { PTSessionModal } from '@/components/features/PTSessionModal';
import { PersonalTraining, PTSession } from '@/types';
import { supabase } from '@/api/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatDate, getLocalDateStr } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { cleanupPTNotifications } from '@/utils/personalTraining';
import { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'active' | 'requests' | 'sessions';

export function PersonalTrainingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();
  const { user } = useAuth();
  const dialog = useDialog();

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [selectedPT, setSelectedPT] = useState<PersonalTraining | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<'schedule' | 'complete'>('schedule');
  const [activeSession, setActiveSession] = useState<PTSession | null>(null);

  // Fetch all PT plans
  const { data: ptList, refetch: refetchPT } = useQuery({
    queryKey: ['mobile-pt-list'],
    queryFn: async () => {
      try {
        let query = supabase
          .from('personal_training')
          .select(`
            *,
            members(*),
            trainer:user_profiles!personal_training_trainer_id_fkey(*)
          `)
          .order('created_at', { ascending: false });

        // If user is TRAINER, only see assigned clients
        if (user?.role === 'TRAINER') {
          query = query.eq('trainer_id', user.id);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Mobile PT list query note:', error.message);
          return [];
        }
        return (data || []) as PersonalTraining[];
      } catch (err) {
        console.warn('Mobile PT list query error:', err);
        return [];
      }
    },
  });

  // Fetch sessions
  const { data: allSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['mobile-pt-sessions'],
    queryFn: async () => {
      try {
        let query = supabase
          .from('pt_sessions')
          .select(`
            *,
            personal_training(*),
            members(*),
            trainer:user_profiles!pt_sessions_trainer_id_fkey(*)
          `)
          .order('session_date', { ascending: false })
          .order('start_time', { ascending: true })
          .limit(50);

        if (user?.role === 'TRAINER') {
          query = query.eq('trainer_id', user.id);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Mobile PT sessions query note:', error.message);
          return [];
        }
        return (data || []) as PTSession[];
      } catch (err) {
        console.warn('Mobile PT sessions query error:', err);
        return [];
      }
    },
  });

  const onRefresh = async () => {
    haptics.light();
    setRefreshing(true);
    await Promise.all([refetchPT(), refetchSessions()]);
    setRefreshing(false);
  };

  const handleCancelPT = (pt: PersonalTraining) => {
    const isPaid = !!pt.payment_id;
    const memberName = pt.members?.full_name || 'Member';
    const confirmMsg = isPaid
      ? `Cancel Personal Training for ${memberName}?\n\nThis will DELETE the Personal Training add-on payment (${formatCurrency(pt.price || 0)}) and remove all scheduled sessions.`
      : `Cancel this Personal Training request for ${memberName}?`;

    dialog.danger(
      'Cancel Personal Training',
      confirmMsg,
      isPaid ? 'Yes, Cancel & Refund' : 'Yes, Cancel Request',
      async () => {
        try {
          if (pt.payment_id) {
            await supabase.from('payments').delete().eq('id', pt.payment_id);
          }
          await supabase.from('pt_sessions').delete().eq('personal_training_id', pt.id);
          const { error } = await supabase.from('personal_training').delete().eq('id', pt.id);
          if (error) throw error;

          // Remove all notifications related to this specific member's Personal Training
          await cleanupPTNotifications(pt.member_id, memberName);

          haptics.success();
          refetchPT();
          refetchSessions();
          qc.invalidateQueries({ queryKey: ['mobile-pt-list'] });
          qc.invalidateQueries({ queryKey: ['mobile-pt-sessions'] });
          qc.invalidateQueries({ queryKey: ['mobile-payments'] });
          qc.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
          qc.invalidateQueries({ queryKey: ['notifications'] });
          qc.invalidateQueries({ queryKey: ['notifications-unread'] });

          setTimeout(() => {
            dialog.alert('Cancelled', 'Personal Training cancelled and payment removed.');
          }, 200);
        } catch (err: unknown) {
          haptics.error();
          setTimeout(() => {
            dialog.alert('Error', (err as Error).message || 'Failed to cancel');
          }, 200);
        }
      },
      'Keep Program'
    );
  };

  // Filtered lists
  const activeClients = useMemo(() => {
    return (ptList || []).filter(pt => {
      const matchesTab = pt.status === 'ACTIVE';
      const name = pt.members?.full_name?.toLowerCase() || '';
      const phone = pt.members?.mobile?.toLowerCase() || '';
      const query = searchQuery.toLowerCase().trim();
      return matchesTab && (!query || name.includes(query) || phone.includes(query));
    });
  }, [ptList, searchQuery]);

  const requestsQueue = useMemo(() => {
    return (ptList || []).filter(pt => {
      const matchesTab = pt.status === 'REQUESTED' || pt.status === 'PENDING_PAYMENT';
      const name = pt.members?.full_name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase().trim();
      return matchesTab && (!query || name.includes(query));
    });
  }, [ptList, searchQuery]);

  const filteredSessions = useMemo(() => {
    return (allSessions || []).filter(s => {
      const name = s.members?.full_name?.toLowerCase() || '';
      const notes = s.workout_notes?.toLowerCase() || '';
      const query = searchQuery.toLowerCase().trim();
      return !query || name.includes(query) || notes.includes(query);
    });
  }, [allSessions, searchQuery]);

  const pendingRequestsCount = useMemo(() => {
    return (ptList || []).filter(pt => pt.status === 'REQUESTED' || pt.status === 'PENDING_PAYMENT').length;
  }, [ptList]);

  return (
    <View style={styles.container}>
      <FVEHeader title="PERSONAL TRAINING" showBack />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('active');
          }}
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          activeOpacity={0.7}
        >
          <Dumbbell size={14} color={activeTab === 'active' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active Clients ({activeClients.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('requests');
          }}
          style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
            {pendingRequestsCount > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.selection();
            setActiveTab('sessions');
          }}
          style={[styles.tabBtn, activeTab === 'sessions' && styles.tabBtnActive]}
          activeOpacity={0.7}
        >
          <Calendar size={14} color={activeTab === 'sessions' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
            Sessions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <FVEInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search client by name or phone..."
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* ACTIVE CLIENTS TAB */}
        {activeTab === 'active' && (
          <View>
            {activeClients.length === 0 ? (
              <View style={styles.emptyCard}>
                <Dumbbell size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Active PT Clients Found</Text>
                <Text style={styles.emptySubtitle}>
                  Members can add Personal Training at any time from their member profile screen.
                </Text>
              </View>
            ) : (
              activeClients.map(pt => {
                const pct = Math.round(((pt.sessions_completed || 0) / (pt.total_sessions || 1)) * 100);
                return (
                  <View key={pt.id} style={styles.card}>
                    {/* Header */}
                    <TouchableOpacity
                      onPress={() => navigation.navigate('MemberDetail', { memberId: pt.member_id })}
                      style={styles.cardHeader}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{pt.members?.full_name}</Text>
                        <Text style={styles.packageTitle}>{pt.package_name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <FVEBadge
                          label="ACTIVE"
                          color={colors.success}
                          bgColor={colors.successMuted}
                          borderColor={colors.successBorder}
                        />
                        <Text style={styles.priceTag}>{formatCurrency(pt.price || 0)}</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Trainer info */}
                    <View style={styles.trainerRow}>
                      <User size={13} color="#C084FC" />
                      <Text style={styles.trainerLabel}>
                        Trainer: <Text style={{ color: '#E9D5FF', fontWeight: '700' }}>{pt.trainer?.full_name || 'Staff'}</Text>
                      </Text>
                    </View>

                    {/* Progress Gauge */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Sessions Completed</Text>
                        <Text style={styles.progressVal}>
                          {pt.sessions_completed || 0} / {pt.total_sessions} ({pct}%)
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%` }]} />
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => {
                          haptics.selection();
                          setSelectedPT(pt);
                          setActiveSession(null);
                          setSessionModalMode('schedule');
                          setShowSessionModal(true);
                        }}
                        style={styles.actionBtnGold}
                        activeOpacity={0.7}
                      >
                        <Calendar size={13} color="#000" />
                        <Text style={styles.actionBtnGoldText}>Schedule Session</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => navigation.navigate('MemberDetail', { memberId: pt.member_id })}
                        style={styles.actionBtnOutline}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionBtnOutlineText}>Profile</Text>
                        <ChevronRight size={13} color={colors.textMuted} />
                      </TouchableOpacity>

                      {['OWNER', 'ADMIN'].includes(user?.role || '') && (
                        <TouchableOpacity
                          onPress={() => handleCancelPT(pt)}
                          style={[styles.actionBtnOutline, { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={13} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <View>
            {requestsQueue.length === 0 ? (
              <View style={styles.emptyCard}>
                <CheckCircle2 size={32} color={colors.success} />
                <Text style={styles.emptyTitle}>Queue Is Clear!</Text>
                <Text style={styles.emptySubtitle}>
                  No pending Personal Training requests or uncollected add-on payments.
                </Text>
              </View>
            ) : (
              requestsQueue.map(pt => (
                <View key={pt.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{pt.members?.full_name}</Text>
                      <Text style={styles.packageTitle}>{pt.package_name}</Text>
                    </View>
                    <FVEBadge
                      label={pt.status === 'REQUESTED' ? 'REQUESTED' : 'PAYMENT PENDING'}
                      color={pt.status === 'REQUESTED' ? colors.gold : colors.warning}
                      bgColor={pt.status === 'REQUESTED' ? colors.goldMuted : colors.warningMuted}
                      borderColor={pt.status === 'REQUESTED' ? colors.goldBorder : colors.warningBorder}
                    />
                  </View>

                  {/* Special goals / notes */}
                  {pt.special_goals ? (
                    <View style={styles.goalsBox}>
                      <Text style={styles.goalsLabel}>GOALS:</Text>
                      <Text style={styles.goalsText}>{pt.special_goals}</Text>
                    </View>
                  ) : null}

                  {/* Action buttons */}
                  <View style={[styles.actionRow, { marginTop: 12 }]}>
                    {pt.status === 'REQUESTED' && ['OWNER', 'ADMIN'].includes(user?.role || '') && (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.selection();
                          setSelectedPT(pt);
                          setShowAssignModal(true);
                        }}
                        style={styles.actionBtnGold}
                        activeOpacity={0.7}
                      >
                        <User size={13} color="#000" />
                        <Text style={styles.actionBtnGoldText}>Assign Trainer & Price</Text>
                      </TouchableOpacity>
                    )}

                    {pt.status === 'PENDING_PAYMENT' && (
                      <TouchableOpacity
                        onPress={() => {
                          haptics.selection();
                          setSelectedPT(pt);
                          setShowPayModal(true);
                        }}
                        style={styles.actionBtnGold}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionBtnGoldText}>
                          Collect Payment ({formatCurrency(pt.price || 0)})
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => navigation.navigate('MemberDetail', { memberId: pt.member_id })}
                      style={styles.actionBtnOutline}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionBtnOutlineText}>View Member</Text>
                    </TouchableOpacity>

                    {['OWNER', 'ADMIN'].includes(user?.role || '') && (
                      <TouchableOpacity
                        onPress={() => handleCancelPT(pt)}
                        style={[styles.actionBtnOutline, { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={13} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <View>
            {filteredSessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Calendar size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Sessions Found</Text>
                <Text style={styles.emptySubtitle}>
                  Scheduled personal training sessions will appear here for easy check-in and completion.
                </Text>
              </View>
            ) : (
              filteredSessions.map(s => (
                <View key={s.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{s.members?.full_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Clock size={12} color={colors.gold} />
                        <Text style={styles.sessionDateTime}>
                          {formatDate(s.session_date)} at {s.start_time}
                        </Text>
                      </View>
                    </View>
                    <FVEBadge
                      label={s.status}
                      color={s.status === 'COMPLETED' ? colors.success : colors.gold}
                      bgColor={s.status === 'COMPLETED' ? colors.successMuted : colors.goldMuted}
                      borderColor={s.status === 'COMPLETED' ? colors.successBorder : colors.goldBorder}
                    />
                  </View>

                  {/* Workout details */}
                  {s.workout_notes ? (
                    <Text style={styles.sessionWorkoutNotes}>{s.workout_notes}</Text>
                  ) : null}

                  {s.feedback ? (
                    <Text style={styles.sessionFeedback}>Feedback: {s.feedback}</Text>
                  ) : null}

                  {/* Complete button */}
                  {s.status === 'SCHEDULED' && (
                    <View style={{ marginTop: 10 }}>
                      <TouchableOpacity
                        onPress={() => {
                          haptics.selection();
                          setSelectedPT(s.personal_training as PersonalTraining);
                          setActiveSession(s);
                          setSessionModalMode('complete');
                          setShowSessionModal(true);
                        }}
                        style={styles.completeBtn}
                        activeOpacity={0.7}
                      >
                        <CheckCircle2 size={14} color={colors.success} />
                        <Text style={styles.completeBtnText}>Mark Session Completed</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      {selectedPT && (
        <PTAssignmentModal
          visible={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedPT(null);
          }}
          onSaved={() => {
            refetchPT();
            qc.invalidateQueries({ queryKey: ['mobile-pt-list'] });
          }}
          pt={selectedPT}
        />
      )}

      {selectedPT && (
        <PTPaymentModal
          visible={showPayModal}
          onClose={() => {
            setShowPayModal(false);
            setSelectedPT(null);
          }}
          onSaved={() => {
            refetchPT();
            qc.invalidateQueries({ queryKey: ['mobile-pt-list'] });
            qc.invalidateQueries({ queryKey: ['mobile-pt-sessions'] });
          }}
          pt={selectedPT}
        />
      )}

      {selectedPT && (
        <PTSessionModal
          visible={showSessionModal}
          onClose={() => {
            setShowSessionModal(false);
            setSelectedPT(null);
            setActiveSession(null);
          }}
          onSaved={() => {
            refetchPT();
            refetchSessions();
            qc.invalidateQueries({ queryKey: ['mobile-pt-list'] });
            qc.invalidateQueries({ queryKey: ['mobile-pt-sessions'] });
          }}
          pt={selectedPT}
          session={activeSession}
          mode={sessionModalMode}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1216',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 161, 0, 0.2)',
    paddingHorizontal: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.gold,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: typography.fonts.rajdhani,
  },
  tabTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  badgeCount: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeCountText: {
    fontSize: 10,
    color: '#000',
    fontWeight: '800',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#050505',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: '#0F1216',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  packageTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  priceTag: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
    fontFamily: typography.fonts.rajdhani,
    marginTop: 4,
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  trainerLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
  },
  progressContainer: {
    marginVertical: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fonts.inter,
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fonts.rajdhani,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtnGold: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  actionBtnGoldText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    fontFamily: typography.fonts.rajdhani,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
  },
  goalsBox: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 6,
  },
  goalsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
    fontFamily: typography.fonts.rajdhani,
  },
  goalsText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fonts.inter,
  },
  sessionDateTime: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '600',
    fontFamily: typography.fonts.rajdhani,
  },
  sessionWorkoutNotes: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.fonts.inter,
    marginTop: 4,
  },
  sessionFeedback: {
    fontSize: 11,
    color: '#86EFAC',
    fontFamily: typography.fonts.inter,
    marginTop: 2,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    fontFamily: typography.fonts.rajdhani,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 30,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
    fontFamily: typography.fonts.rajdhani,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    fontFamily: typography.fonts.inter,
  },
});
