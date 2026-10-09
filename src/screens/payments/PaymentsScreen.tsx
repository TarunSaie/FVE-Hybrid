import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CreditCard, Filter, X, QrCode, Ticket, CheckCircle2, Clock, XCircle, Share2, Trash2, FileText } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { FVEHeader } from '@/components/common/FVEHeader';
import { FVEInput } from '@/components/common/FVEInput';
import { PaymentItem } from '@/components/features/PaymentItem';
import { PaymentFormModal } from '@/components/features/PaymentFormModal';
import { DailyPassFormModal } from '@/components/features/DailyPassFormModal';
import { UPIQRCodeModal } from '@/components/features/UPIQRCodeModal';
import { ProfilePhotoModal } from '@/components/features/ProfilePhotoModal';
import { FVEModal } from '@/components/common/FVEModal';
import { FVEEmptyState } from '@/components/common/FVEEmptyState';
import { FVELogoLoader } from '@/components/common/FVELogoLoader';
import { M3Switch } from '@/components/common/M3Switch';
import { Payment, DailyPass, PAYMENT_METHODS } from '@/types';
import { supabase } from '@/api/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { RootStackParamList } from '@/navigation/types';
import { buildReceiptDataFromPayment, sharePdfReceipt, directShareReceiptToWhatsApp, shareReceiptPdfToWhatsApp } from '@/utils/receiptPdf';

import { haptics } from '@/utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { revertOrDeletePayment } from '@/utils/paymentOperations';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PaymentsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getPaymentsStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState<'memberships' | 'daily_passes'>('memberships');
  const [includeDailyPasses, setIncludeDailyPasses] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const [showPayModal, setShowPayModal] = useState(false);
  const [showDailyPassModal, setShowDailyPassModal] = useState(false);
  const [showUPIModal, setShowUPIModal] = useState(false);
  const [previewMember, setPreviewMember] = useState<{
    profile_photo?: string | null;
    full_name: string;
    member_id?: string | null;
  } | null>(null);
  const [actionMenuPayment, setActionMenuPayment] = useState<Payment | null>(null);

  // 1. Query Membership Payments with Joined Members
  const { data: payments = [], isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['mobile-payments', debouncedSearch, methodFilter],
    queryFn: async () => {
      const term = debouncedSearch.trim();
      let memberIds: string[] = [];

      if (term) {
        const { data: matchedMembers } = await supabase
          .from('members')
          .select('id')
          .or(`full_name.ilike.%${term}%,member_id.ilike.%${term}%,mobile.ilike.%${term}%`);

        if (matchedMembers && matchedMembers.length > 0) {
          memberIds = matchedMembers.map((m) => m.id);
        }
      }

      let q = supabase
        .from('payments')
        .select('*, members(full_name, mobile, member_id, profile_photo), memberships(id, start_date, expiry_date, status, visit_day_limit, visit_days_used, membership_plans(name, duration_days))')
        .order('created_at', { ascending: false });

      if (methodFilter) {
        q = q.eq('payment_method', methodFilter);
      }

      if (term) {
        if (memberIds.length > 0) {
          q = q.or(
            `receipt_number.ilike.%${term}%,transaction_reference.ilike.%${term}%,member_id.in.(${memberIds.join(',')})`
          );
        } else {
          q = q.or(
            `receipt_number.ilike.%${term}%,transaction_reference.ilike.%${term}%`
          );
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Payment[];
    },
  });

  // 2. Query Daily Pass Transactions
  const { data: dailyPasses = [], isLoading: isDailyPassesLoading } = useQuery({
    queryKey: ['mobile-payments-daily-passes', debouncedSearch, methodFilter],
    queryFn: async () => {
      const term = debouncedSearch.trim();
      let q = supabase
        .from('daily_passes')
        .select('*')
        .order('created_at', { ascending: false });

      if (methodFilter) {
        q = q.eq('payment_method', methodFilter);
      }

      if (term) {
        q = q.or(
          `visitor_name.ilike.%${term}%,mobile.ilike.%${term}%,purpose.ilike.%${term}%,notes.ilike.%${term}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DailyPass[];
    },
  });

  // Calculate filtered revenues
  const membershipRevenue = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const dailyPassRevenue = dailyPasses
    .filter((p) => p.payment_status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const membershipCount = payments.length;
  const dailyPassCount = dailyPasses.length;

  // Compute displayed summary totals based on toggle and active tab:
  // When toggle is ON: Combined (Memberships + Daily Passes)
  // When toggle is OFF: Individual data for whichever tab is active
  const displayTotalRevenue = includeDailyPasses
    ? membershipRevenue + dailyPassRevenue
    : activeTab === 'memberships'
      ? membershipRevenue
      : dailyPassRevenue;

  const displayTotalRecords = includeDailyPasses
    ? membershipCount + dailyPassCount
    : activeTab === 'memberships'
      ? membershipCount
      : dailyPassCount;

  const isLoading = activeTab === 'memberships' ? isPaymentsLoading : isDailyPassesLoading;

  const onRefresh = useCallback(() => {
    haptics.light();
    qc.invalidateQueries({ queryKey: ['mobile-payments'] });
    qc.invalidateQueries({ queryKey: ['mobile-payments-daily-passes'] });
  }, [qc]);

  const handleMethodSelect = (method: string) => {
    haptics.selection();
    setMethodFilter(method);
  };

  const handleShareWhatsApp = async (p: Payment) => {
    haptics.medium();
    const memberName = p.members?.full_name || 'Member';
    const memberMobile = p.members?.mobile;

    if (!memberMobile) {
      Alert.alert(
        'No Mobile Number',
        `${memberName} does not have a registered mobile number for direct WhatsApp redirection. Would you like to share the PDF invoice via the system share sheet?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share PDF File',
            onPress: async () => {
              try {
                const receiptData = buildReceiptDataFromPayment(p);
                await sharePdfReceipt(receiptData);
              } catch (err) {
                Alert.alert('Error', (err as Error).message || 'Failed to share receipt');
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Share Receipt',
      `Choose how to share Receipt #${p.receipt_number || 'N/A'} for ${memberName}:`,
      [
        {
          text: '⚡ Direct WhatsApp (with PDF Link)',
          onPress: async () => {
            try {
              haptics.medium();
              const receiptData = buildReceiptDataFromPayment(p);
              await directShareReceiptToWhatsApp(receiptData, memberMobile);
            } catch (err) {
              Alert.alert('Error', (err as Error).message || 'Failed to dispatch WhatsApp receipt');
            }
          },
        },
        {
          text: '📎 Attach PDF (Share Sheet)',
          onPress: async () => {
            try {
              haptics.light();
              const receiptData = buildReceiptDataFromPayment(p);
              await sharePdfReceipt(receiptData);
            } catch (err) {
              Alert.alert('Error', (err as Error).message || 'Failed to share receipt PDF');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDeletePayment = async (p: Payment) => {
    haptics.warning();
    const isUpgrade = p.notes?.includes('Plan Upgrade:');
    const memberName = p.members?.full_name || 'Member';
    const amountStr = formatCurrency(p.amount);
    const receiptNo = p.receipt_number || 'N/A';

    const confirmMsg = isUpgrade
      ? `Are you sure you want to revert receipt #${receiptNo} of ${amountStr} for ${memberName}?\n\nThis payment was collected for a Plan Upgrade. Reverting it will delete this payment transaction and restore ${memberName}'s previous membership plan.`
      : `Are you sure you want to delete payment receipt #${receiptNo} of ${amountStr} for ${memberName}?\n\nThis will permanently remove the payment transaction from gym financial records and member history.`;

    Alert.alert(
      isUpgrade ? 'Revert Plan Upgrade & Payment' : 'Delete Payment Transaction',
      confirmMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUpgrade ? 'Yes, Revert & Delete' : 'Yes, Delete Payment',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.medium();
              const result = await revertOrDeletePayment({
                paymentId: p.id,
                receiptNumber: p.receipt_number,
                amount: p.amount,
                memberName: p.members?.full_name,
              });

              Alert.alert('Success', result.message || 'Payment successfully removed');
              qc.invalidateQueries({ queryKey: ['mobile-payments'] });
              qc.invalidateQueries({ queryKey: ['member-payments'] });
              qc.invalidateQueries({ queryKey: ['members'] });
            } catch (err) {
              Alert.alert('Error', (err as Error).message || 'Failed to delete payment');
            }
          },
        },
      ]
    );
  };

  // Render Daily Pass transaction card
  const renderDailyPassItem = ({ item }: { item: DailyPass }) => {
    const isPaid = item.payment_status === 'PAID';
    const isPending = item.payment_status === 'PENDING';

    return (
      <View style={styles.dpCard}>
        <View style={styles.dpTopRow}>
          <View style={styles.dpVisitorWrap}>
            <View style={styles.dpAvatar}>
              <Text style={styles.dpAvatarText}>
                {item.visitor_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text numberOfLines={1} style={styles.dpVisitorName}>
                {item.visitor_name}
              </Text>
              <Text style={styles.dpMetaText}>
                {item.mobile || 'No Mobile'} {item.purpose ? `• ${item.purpose}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.dpAmountWrap}>
            <Text style={styles.dpAmountText}>
              {formatCurrency(Number(item.amount || 0))}
            </Text>
            <View
              style={[
                styles.dpStatusBadge,
                isPaid ? styles.dpStatusPaid : isPending ? styles.dpStatusPending : styles.dpStatusWaived,
              ]}
            >
              {isPaid && <CheckCircle2 size={11} color={colors.success} style={{ marginRight: 3 }} />}
              {isPending && <Clock size={11} color="#F59E0B" style={{ marginRight: 3 }} />}
              {item.payment_status === 'WAIVED' && <XCircle size={11} color={colors.textMuted} style={{ marginRight: 3 }} />}
              <Text
                style={[
                  styles.dpStatusText,
                  isPaid ? styles.dpStatusTextPaid : isPending ? styles.dpStatusTextPending : styles.dpStatusTextWaived,
                ]}
              >
                {item.payment_status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.dpBottomRow}>
          <Text style={styles.dpDateText}>Pass Date: {formatDate(item.pass_date)}</Text>
          <View style={styles.dpMethodPill}>
            <Text style={styles.dpMethodText}>{item.payment_method}</Text>
          </View>
        </View>

        {item.notes ? (
          <Text numberOfLines={1} style={styles.dpNotesText}>
            Note: {item.notes}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FVEHeader
        title="PAYMENTS"
        subtitle={
          includeDailyPasses
            ? `${membershipCount + dailyPassCount} combined transactions`
            : activeTab === 'memberships'
              ? `${membershipCount} membership transactions`
              : `${dailyPassCount} daily pass transactions`
        }
        showLogo={false}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              navigation.navigate('PaymentQR');
            }}
            style={styles.qrHeaderBtn}
            activeOpacity={0.75}
          >
            <QrCode size={14} color={colors.gold} />
            <Text style={styles.qrHeaderBtnText}>UPI QR</Text>
          </TouchableOpacity>
        }
      />

      {/* Revenue Header Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryLabel}>
              {includeDailyPasses && activeTab === 'memberships'
                ? 'TOTAL COMBINED REVENUE'
                : activeTab === 'memberships'
                  ? 'MEMBERSHIP REVENUE'
                  : 'DAILY PASS REVENUE'}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>
              {formatCurrency(displayTotalRevenue)}
            </Text>
          </View>
        </View>

        {/* Daily Pass Combine M3 Switch (Only shown on Membership tab) */}
        {activeTab === 'memberships' && (
          <View style={styles.m3ToggleCard}>
            <View style={styles.m3ToggleLeft}>
              <View style={[styles.m3ToggleIconBox, includeDailyPasses && styles.m3ToggleIconBoxActive]}>
                <Ticket size={16} color={includeDailyPasses ? colors.gold : colors.textMuted} />
              </View>
              <View style={styles.m3ToggleTextBox}>
                <Text style={[styles.m3ToggleTitle, includeDailyPasses && styles.m3ToggleTitleActive]}>
                  Combine Daily Pass Revenue
                </Text>
                <Text style={styles.m3ToggleSubtitle}>
                  {includeDailyPasses
                    ? `Includes +₹${formatCurrency(dailyPassRevenue)} from day pass receipts`
                    : 'Toggle to merge daily pass sales into total'}
                </Text>
              </View>
            </View>
            <M3Switch
              value={includeDailyPasses}
              onValueChange={setIncludeDailyPasses}
              accessibilityLabel="Combine Daily Pass Revenue"
            />
          </View>
        )}
      </View>

      {/* Segmented Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setActiveTab('memberships');
          }}
          style={[styles.tabButton, activeTab === 'memberships' && styles.tabButtonActive]}
          activeOpacity={0.8}
        >
          <CreditCard size={14} color={activeTab === 'memberships' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'memberships' && styles.tabTextActive]}>
            Membership
          </Text>
          <View style={[styles.tabBadge, activeTab === 'memberships' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'memberships' && styles.tabBadgeTextActive]}>
              {membershipCount}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setActiveTab('daily_passes');
          }}
          style={[styles.tabButton, activeTab === 'daily_passes' && styles.tabButtonActive]}
          activeOpacity={0.8}
        >
          <Ticket size={14} color={activeTab === 'daily_passes' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'daily_passes' && styles.tabTextActive]}>
            Daily Pass
          </Text>
          <View style={[styles.tabBadge, activeTab === 'daily_passes' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'daily_passes' && styles.tabBadgeTextActive]}>
              {dailyPassCount}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search and Filters Section */}
      <View style={styles.filterSection}>
        <FVEInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            activeTab === 'memberships'
              ? 'Search member, ID, receipt no...'
              : 'Search visitor name, mobile, purpose...'
          }
          leftIcon={<Search size={16} color={colors.gold} />}
          rightIcon={search ? <X size={16} color={colors.textSecondary} /> : undefined}
          onRightIconPress={() => setSearch('')}
          containerStyle={{ marginBottom: 10 }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => handleMethodSelect('')}
            style={[styles.filterChip, !methodFilter && styles.selectedFilterChip]}
          >
            <Text style={[styles.filterChipText, !methodFilter && styles.selectedFilterChipText]}>
              All Methods
            </Text>
          </TouchableOpacity>

          {PAYMENT_METHODS.map((m) => {
            const isSelected = methodFilter === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => handleMethodSelect(m)}
                style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.selectedFilterChipText]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Payments or Daily Pass List */}
      {isLoading ? (
        <FVELogoLoader message={activeTab === 'memberships' ? 'Syncing Payments...' : 'Syncing Daily Passes...'} fullScreen />
      ) : activeTab === 'memberships' ? (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PaymentItem
              payment={item}
              onPress={() => navigation.navigate('PaymentReceipt', { payment: item })}
              onMenuPress={(p) => setActionMenuPayment(p)}
              onAvatarPress={(p) => {
                if (p.members) {
                  setPreviewMember({
                    profile_photo: p.members.profile_photo,
                    full_name: p.members.full_name,
                    member_id: p.members.member_id,
                  });
                }
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <FVEEmptyState
                icon={<CreditCard size={40} color={colors.gold} />}
                title="No Payments Found"
                description="Membership payments will show up here once processed."
                actionTitle="+ Record Payment"
                onAction={() => setShowPayModal(true)}
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={dailyPasses}
          keyExtractor={(item) => item.id}
          renderItem={renderDailyPassItem}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <FVEEmptyState
                icon={<Ticket size={40} color={colors.gold} />}
                title="No Daily Passes Found"
                description="Daily passes will appear here once visitors register."
                actionTitle="+ Issue Daily Pass"
                onAction={() => setShowDailyPassModal(true)}
              />
            ) : null
          }
        />
      )}

      {/* Native Floating Action Button (FAB) */}
      <TouchableOpacity
        onPress={() => {
          haptics.light();
          if (activeTab === 'memberships') {
            setShowPayModal(true);
          } else {
            setShowDailyPassModal(true);
          }
        }}
        style={styles.fab}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.goldBright, colors.gold, colors.goldDark]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Plus size={24} color={colors.bgPrimary} strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Membership Payment Form Modal */}
      {showPayModal && (
        <PaymentFormModal
          visible={showPayModal}
          onClose={() => setShowPayModal(false)}
          onSaved={() => {
            setShowPayModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Daily Pass Form Modal */}
      {showDailyPassModal && (
        <DailyPassFormModal
          visible={showDailyPassModal}
          onClose={() => setShowDailyPassModal(false)}
          onSaved={() => {
            setShowDailyPassModal(false);
            onRefresh();
          }}
        />
      )}

      {/* UPI QR Code Modal */}
      {showUPIModal && (
        <UPIQRCodeModal
          visible={showUPIModal}
          onClose={() => setShowUPIModal(false)}
        />
      )}

      {/* Full-Size Profile Photo Modal */}
      <ProfilePhotoModal
        visible={!!previewMember}
        onClose={() => setPreviewMember(null)}
        photoUrl={previewMember?.profile_photo}
        memberName={previewMember?.full_name || 'Member'}
        memberId={previewMember?.member_id}
      />

      {/* Payment Action Menu Modal */}
      <FVEModal
        visible={!!actionMenuPayment}
        onClose={() => setActionMenuPayment(null)}
        title={actionMenuPayment ? `Receipt #${actionMenuPayment.receipt_number || 'N/A'}` : 'Receipt Options'}
        subtitle={
          actionMenuPayment
            ? `${actionMenuPayment.members?.full_name || 'Member'} · ${formatCurrency(actionMenuPayment.amount)}`
            : undefined
        }
      >
        {actionMenuPayment && (
          <View style={styles.menuModalContent}>
            <TouchableOpacity
              onPress={() => {
                const target = actionMenuPayment;
                setActionMenuPayment(null);
                haptics.medium();
                handleShareWhatsApp(target);
              }}
              style={[styles.menuModalItem, { borderColor: colors.borderDark }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share receipt on WhatsApp"
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: isDark ? 'rgba(37, 211, 102, 0.15)' : '#DCFCE7' }]}>
                <Share2 size={18} color="#25D366" />
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                  Share Receipt on WhatsApp
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  Send official receipt confirmation to member phone
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const target = actionMenuPayment;
                setActionMenuPayment(null);
                haptics.light();
                navigation.navigate('PaymentReceipt', { payment: target });
              }}
              style={[styles.menuModalItem, { borderColor: colors.borderDark }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View receipt details"
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: colors.goldMuted }]}>
                <FileText size={18} color={colors.gold} />
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: colors.textPrimary }]}>
                  View Receipt Details
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  Full transaction breakdown and subscription summary
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const target = actionMenuPayment;
                setActionMenuPayment(null);
                handleDeletePayment(target);
              }}
              style={[styles.menuModalItem, { borderColor: colors.borderDark, borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete payment record"
            >
              <View style={[styles.menuModalIconWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                <Trash2 size={18} color="#EF4444" />
              </View>
              <View style={styles.menuModalTextWrap}>
                <Text style={[styles.menuModalTitle, { color: colors.error }]}>
                  Delete Payment Record
                </Text>
                <Text style={[styles.menuModalDesc, { color: colors.textMuted }]}>
                  Revert membership extension and remove transaction
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </FVEModal>
    </View>
  );
}

const getPaymentsStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    qrHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.4)' : 'rgba(217, 130, 0, 0.4)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    qrHeaderBtnText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    summaryCard: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 18,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 10,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    summaryTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryLeft: {
      flex: 1,
      marginRight: 12,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    summaryValue: {
      color: colors.gold,
      fontSize: typography.sizes.xxl,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      marginTop: 2,
    },
    recordCountBox: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 161, 0, 0.25)' : 'rgba(217, 130, 0, 0.25)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexShrink: 0,
    },
    recordCountText: {
      color: colors.gold,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    m3ToggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderDark,
    },
    m3ToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 12,
    },
    m3ToggleIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9',
      borderWidth: 1,
      borderColor: colors.borderDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    m3ToggleIconBoxActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.12)' : 'rgba(217, 130, 0, 0.12)',
      borderColor: colors.goldBorder,
    },
    m3ToggleTextBox: {
      flex: 1,
    },
    m3ToggleTitle: {
      fontSize: 12,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    m3ToggleTitleActive: {
      color: colors.gold,
    },
    m3ToggleSubtitle: {
      fontSize: 10.5,
      fontFamily: typography.fonts.inter,
      color: colors.textSecondary,
      marginTop: 1,
      lineHeight: 14,
    },

    // Segmented Tabs
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 9,
    },
    tabButtonActive: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(217, 130, 0, 0.15)',
      borderWidth: 1,
      borderColor: colors.goldBorder,
    },
    tabText: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    tabTextActive: {
      color: colors.gold,
    },
    tabBadge: {
      backgroundColor: isDark ? '#222' : '#e5e5e5',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
    },
    tabBadgeActive: {
      backgroundColor: colors.goldMuted,
    },
    tabBadgeText: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    tabBadgeTextActive: {
      color: colors.gold,
    },

    filterSection: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderDark,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      marginRight: 8,
    },
    selectedFilterChip: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.15)' : 'rgba(217, 130, 0, 0.15)',
      borderColor: isDark ? 'rgba(239, 161, 0, 0.35)' : 'rgba(217, 130, 0, 0.35)',
    },
    filterChipText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    selectedFilterChipText: {
      color: colors.gold,
    },
    listContent: {
      padding: 16,
      paddingBottom: 160,
    },

    // Daily Pass Card Styles
    dpCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    dpTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dpVisitorWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    dpAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.goldMuted,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dpAvatarText: {
      color: colors.gold,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
    },
    dpVisitorName: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontFamily: typography.fonts.inter,
      fontWeight: '700',
    },
    dpMetaText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
    dpAmountWrap: {
      alignItems: 'flex-end',
    },
    dpAmountText: {
      color: colors.gold,
      fontSize: typography.sizes.base,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '800',
      marginBottom: 3,
    },
    dpStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    dpStatusPaid: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.15)',
    },
    dpStatusPending: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.15)',
    },
    dpStatusWaived: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    },
    dpStatusText: {
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    dpStatusTextPaid: {
      color: colors.success,
    },
    dpStatusTextPending: {
      color: '#F59E0B',
    },
    dpStatusTextWaived: {
      color: colors.textMuted,
    },
    dpBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderDark,
    },
    dpDateText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
    },
    dpMethodPill: {
      backgroundColor: isDark ? 'rgba(239, 161, 0, 0.1)' : 'rgba(217, 130, 0, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    dpMethodText: {
      color: colors.gold,
      fontSize: 10,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
    },
    dpNotesText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: typography.fonts.inter,
      fontStyle: 'italic',
      marginTop: 6,
    },

    fab: {
      position: 'absolute',
      bottom: 96,
      right: 20,
      borderRadius: 30,
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 10,
    },
    fabGradient: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuModalContent: {
      paddingVertical: 4,
    },
    menuModalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 12,
      minHeight: 52,
    },
    menuModalIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuModalTextWrap: {
      flex: 1,
    },
    menuModalTitle: {
      fontSize: 14,
      fontFamily: typography.fonts.rajdhani,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    menuModalDesc: {
      fontSize: 12,
      fontFamily: typography.fonts.inter,
      marginTop: 2,
    },
  });
