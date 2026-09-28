import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RenewalMessageRecord, RenewalBatchSize } from '@/types';
import { getLocalDateStr } from '@/utils/date';
import { supabase } from '@/utils/supabase';

export const RENEWAL_MESSAGES_STORAGE_KEY = '@fve_renewal_messages_sent';

// In-memory cache for synchronous checks
let memoryCache: Record<string, RenewalMessageRecord> | null = null;
let isCacheLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/**
 * Loads records from AsyncStorage into memory cache.
 */
export async function loadRenewalMessageRecords(): Promise<Record<string, RenewalMessageRecord>> {
  try {
    const raw = await AsyncStorage.getItem(RENEWAL_MESSAGES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache = typeof parsed === 'object' && parsed !== null ? parsed : {};
    } else {
      memoryCache = {};
    }
  } catch (err) {
    console.warn('[renewalMessaging] Error loading records from AsyncStorage:', err);
    memoryCache = memoryCache || {};
  }
  isCacheLoaded = true;
  return memoryCache || {};
}

// Kick off initial load
loadRenewalMessageRecords().catch(() => {});

/**
 * Returns current memory cache synchronously.
 */
export function getRenewalMessageRecordsSync(): Record<string, RenewalMessageRecord> {
  return memoryCache || {};
}

/**
 * Synchronous check whether a renewal reminder has already been sent
 * for the given membership and expiry date.
 */
export function isRenewalMessageSent(membershipId: string, expiryDate?: string): boolean {
  if (!membershipId) return false;
  const records = getRenewalMessageRecordsSync();
  const record = records[membershipId];
  if (!record) return false;

  // Match specific expiry date if provided
  if (expiryDate && record.expiryDate) {
    if (record.expiryDate === expiryDate) return true;
  }

  // If sent today or within the last 7 days for this membership
  if (record.sentDate) {
    const today = getLocalDateStr();
    if (record.sentDate === today) return true;
    const sentTime = new Date(record.sentAt || record.sentDate).getTime();
    const nowTime = Date.now();
    const diffDays = (nowTime - sentTime) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays < 7) {
      return true;
    }
  }

  return false;
}

/**
 * Marks a membership as sent in AsyncStorage and memory cache.
 */
export async function markRenewalMessageSent(
  membershipId: string,
  expiryDate: string,
  memberId?: string,
  channel: 'whatsapp' | 'sms' | 'email' = 'whatsapp'
): Promise<void> {
  if (!membershipId) return;

  if (!memoryCache) {
    await loadRenewalMessageRecords();
  }

  const now = new Date();
  const todayStr = getLocalDateStr(now);

  const updated = { ...(memoryCache || {}) };
  updated[membershipId] = {
    membershipId,
    memberId,
    expiryDate,
    sentAt: now.toISOString(),
    sentDate: todayStr,
    channel,
  };

  memoryCache = updated;
  notifyListeners();

  try {
    await AsyncStorage.setItem(RENEWAL_MESSAGES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[renewalMessaging] Failed to save record to AsyncStorage:', err);
  }

  // Background non-blocking sync to Supabase if available
  backgroundSyncToDatabase(membershipId, expiryDate, memberId, channel);
}

/**
 * Marks multiple memberships as sent in a single operation.
 */
export async function markMultipleRenewalMessagesSent(
  items: Array<{ membershipId: string; expiryDate: string; memberId?: string }>
): Promise<void> {
  if (!items || items.length === 0) return;

  if (!memoryCache) {
    await loadRenewalMessageRecords();
  }

  const now = new Date();
  const todayStr = getLocalDateStr(now);

  const updated = { ...(memoryCache || {}) };
  items.forEach((item) => {
    updated[item.membershipId] = {
      membershipId: item.membershipId,
      memberId: item.memberId,
      expiryDate: item.expiryDate,
      sentAt: now.toISOString(),
      sentDate: todayStr,
      channel: 'whatsapp',
    };
  });

  memoryCache = updated;
  notifyListeners();

  try {
    await AsyncStorage.setItem(RENEWAL_MESSAGES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[renewalMessaging] Failed to batch save records:', err);
  }

  items.forEach((item) => {
    backgroundSyncToDatabase(item.membershipId, item.expiryDate, item.memberId, 'whatsapp');
  });
}

/**
 * Clears all recorded renewal messages so owner can restart batches.
 */
export async function clearRenewalMessageRecords(): Promise<void> {
  memoryCache = {};
  notifyListeners();
  try {
    await AsyncStorage.removeItem(RENEWAL_MESSAGES_STORAGE_KEY);
  } catch (err) {
    console.warn('[renewalMessaging] Failed to clear AsyncStorage records:', err);
  }
}

/**
 * Silent non-blocking background sync to Supabase
 */
async function backgroundSyncToDatabase(
  membershipId: string,
  expiryDate: string,
  memberId?: string,
  channel: string = 'whatsapp'
) {
  try {
    Promise.resolve(
      supabase
        .from('memberships')
        .update({ last_renewal_reminder_sent_at: new Date().toISOString() })
        .eq('id', membershipId)
    ).catch(() => {});

    Promise.resolve(
      supabase
        .from('renewal_message_logs')
        .insert({
          membership_id: membershipId,
          member_id: memberId,
          expiry_date: expiryDate,
          channel,
        })
    ).catch(() => {});
  } catch {}
}

/**
 * React hook to reactively subscribe to renewal messaging changes in mobile screens.
 */
export function useRenewalMessagingStatus() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // If cache not yet loaded, load it and bump version
    if (!isCacheLoaded) {
      loadRenewalMessageRecords().then(() => setVersion((v) => v + 1));
    }

    const handler = () => {
      setVersion((v) => v + 1);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const isSent = useCallback(
    (membershipId: string, expiryDate?: string) => {
      return isRenewalMessageSent(membershipId, expiryDate);
    },
    [version]
  );

  const markSent = useCallback(
    (membershipId: string, expiryDate: string, memberId?: string) => {
      markRenewalMessageSent(membershipId, expiryDate, memberId);
    },
    []
  );

  const markBatch = useCallback(
    (items: Array<{ membershipId: string; expiryDate: string; memberId?: string }>) => {
      markMultipleRenewalMessagesSent(items);
    },
    []
  );

  const clearAll = useCallback(() => {
    clearRenewalMessageRecords();
  }, []);

  return {
    isSent,
    markSent,
    markBatch,
    clearAll,
    records: getRenewalMessageRecordsSync(),
    version,
  };
}
