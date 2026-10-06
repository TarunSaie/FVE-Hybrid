import { NativeModules, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { formatWhatsAppPhone } from '@/utils/format';

/**
 * Opens the installed Android WhatsApp client at a member's chat with a PDF and
 * message already attached. Unlike expo-sharing, this does not show Android's
 * app picker or make the owner choose a document destination.
 */
export async function sharePdfToMemberWhatsApp(
  phone: string,
  fileUri: string,
  message?: string,
): Promise<void> {
  const recipient = formatWhatsAppPhone(phone);
  if (recipient.length < 10) {
    throw new Error('The member does not have a valid WhatsApp phone number.');
  }

  // Pre-copy message to clipboard so user can easily paste if WhatsApp only attaches the document
  if (message && message.trim()) {
    try {
      await Clipboard.setStringAsync(message.trim());
    } catch {
      // Non-blocking clipboard copy
    }
  }

  if (Platform.OS !== 'android') {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
      return;
    }
    throw new Error(
      'Direct WhatsApp PDF sharing is currently available on Android only. WhatsApp does not expose an iOS API that can preselect both a chat and an attachment.'
    );
  }

  const nativeModule = NativeModules.WhatsAppPdfShare as unknown as {
    sharePdfToContact: (...args: unknown[]) => Promise<void>;
  } | undefined;

  if (!nativeModule?.sharePdfToContact) {
    // If native module is unavailable, fallback gracefully to expo-sharing
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
      return;
    }
    throw new Error('WhatsApp sharing is unavailable. Install the latest FitVerse Elite Android build and try again.');
  }

  // Handle binary compatibility across Android APK versions:
  // - Installed APK TurboModule signature expects 2 arguments: (recipient, fileUri).
  // - Some builds may expect 3 arguments: (recipient, fileUri, message).
  try {
    await nativeModule.sharePdfToContact(recipient, fileUri);
  } catch (err: unknown) {
    const errorMsg = String((err as Error)?.message || err);
    if (errorMsg.includes('expected argument count: 3')) {
      await nativeModule.sharePdfToContact(recipient, fileUri, message || '');
    } else {
      throw err;
    }
  }
}
