import { NativeModules, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { formatWhatsAppPhone } from '@/utils/format';

type WhatsAppPdfShareModule = {
  sharePdfToContact(phone: string, fileUri: string): Promise<void>;
};

const nativeWhatsAppPdfShare = NativeModules.WhatsAppPdfShare as
  | WhatsAppPdfShareModule
  | undefined;

/**
 * Copies the prepared receipt/pass message, then opens the installed Android
 * WhatsApp client at the member's chat with the PDF attached. This keeps the
 * one-tap handoff while avoiding WhatsApp's unsupported PDF-caption behavior.
 */
export async function sharePdfToMemberWhatsApp(
  phone: string,
  fileUri: string,
  message: string,
): Promise<void> {
  const recipient = formatWhatsAppPhone(phone);
  if (recipient.length < 10) {
    throw new Error('The member does not have a valid WhatsApp phone number.');
  }

  if (Platform.OS !== 'android') {
    throw new Error(
      'Direct WhatsApp PDF sharing is currently available on Android only. WhatsApp does not expose an iOS API that can preselect both a chat and an attachment.'
    );
  }

  if (!nativeWhatsAppPdfShare) {
    throw new Error('WhatsApp sharing is unavailable. Install the latest FitVerse Elite Android build and try again.');
  }

  await Clipboard.setStringAsync(message);
  await nativeWhatsAppPdfShare.sharePdfToContact(recipient, fileUri);
}
