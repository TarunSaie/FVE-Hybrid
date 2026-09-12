import { NativeModules, Platform } from 'react-native';
import { formatWhatsAppPhone } from '@/utils/format';

type WhatsAppPdfShareModule = {
  sharePdfToContact(phone: string, fileUri: string, message: string): Promise<void>;
};

const nativeWhatsAppPdfShare = NativeModules.WhatsAppPdfShare as
  | WhatsAppPdfShareModule
  | undefined;

/**
 * Opens the installed Android WhatsApp client at a member's chat with a PDF and
 * message already attached. Unlike expo-sharing, this does not show Android's
 * app picker or make the owner choose a document destination.
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

  await nativeWhatsAppPdfShare.sharePdfToContact(recipient, fileUri, message);
}
