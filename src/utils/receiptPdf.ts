import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Payment } from '@/types';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { APP_NAME, TAGLINE, CHIRVEX_WEBSITE } from '@/constants/branding';
import { GYM_LOGO_BASE64 } from '@/constants/logoBase64';

export interface ReceiptData {
  receiptNumber: string;
  memberName: string;
  memberId?: string | null;
  memberMobile?: string | null;
  planName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  startDate?: string | null;
  endDate?: string | null;
  transactionReference?: string | null;
}

export function buildReceiptDataFromPayment(payment: Payment): ReceiptData {
  const memberName = payment.members?.full_name || 'Member';
  const memberMobile = payment.members?.mobile;
  const memberId = payment.members?.member_id;
  const plan = payment.memberships?.membership_plans;
  const planName = plan?.name || 'Gym Membership';
  const receiptNo = payment.receipt_number || 'FVE-N/A';
  const dateStr = formatDate(payment.payment_date || payment.created_at);
  const startDate = payment.memberships?.start_date ? formatDate(payment.memberships.start_date) : null;
  const endDate = payment.memberships?.expiry_date ? formatDate(payment.memberships.expiry_date) : null;

  return {
    receiptNumber: receiptNo,
    memberName,
    memberId,
    memberMobile,
    planName,
    amount: Number(payment.amount || 0),
    paymentMethod: payment.payment_method || 'CASH',
    paymentDate: dateStr,
    startDate,
    endDate,
    transactionReference: payment.transaction_reference,
  };
}

export function generateReceiptHtml(data: ReceiptData): string {
  const formattedAmount = formatCurrency(data.amount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt #${data.receiptNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0A0D12;
      color: #FFFFFF;
      padding: 40px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .receipt-card {
      background: linear-gradient(145deg, #141820 0%, #0D1016 100%);
      border: 1.5px solid rgba(239, 161, 0, 0.4);
      border-radius: 20px;
      padding: 36px 40px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid rgba(239, 161, 0, 0.25);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      border: 1.5px solid rgba(239, 161, 0, 0.4);
      background: #0A0D12;
      object-fit: cover;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #EFA100;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 11px;
      letter-spacing: 1.5px;
      color: #8A92A6;
      text-transform: uppercase;
      font-weight: 600;
    }
    .invoice-title-block {
      text-align: right;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #FFFFFF;
      margin-bottom: 6px;
    }
    .receipt-no {
      font-size: 13px;
      font-weight: 700;
      color: #EFA100;
      font-family: monospace;
      letter-spacing: 0.5px;
    }
    .paid-badge {
      display: inline-block;
      margin-top: 6px;
      background-color: rgba(34, 197, 94, 0.15);
      border: 1px solid #22C55E;
      color: #4ADE80;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      padding: 3px 10px;
      border-radius: 20px;
      text-transform: uppercase;
    }
    .hero-amount-box {
      background: rgba(239, 161, 0, 0.08);
      border: 1px solid rgba(239, 161, 0, 0.25);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }
    .amount-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #8A92A6;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .amount-date {
      font-size: 12px;
      color: #BFC3C7;
    }
    .amount-val {
      font-size: 32px;
      font-weight: 800;
      color: #EFA100;
      letter-spacing: 0.5px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    .panel {
      background: #0A0D12;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px 20px;
    }
    .panel-header {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #EFA100;
      text-transform: uppercase;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 6px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .row:last-child {
      margin-bottom: 0;
    }
    .label {
      color: #8A92A6;
      font-weight: 500;
    }
    .val {
      color: #FFFFFF;
      font-weight: 600;
      text-align: right;
    }
    .val-gold {
      color: #EFA100;
      font-weight: 700;
    }
    .footer-note {
      text-align: center;
      padding-top: 20px;
      border-top: 1px dashed rgba(255, 255, 255, 0.1);
      font-size: 11px;
      color: #8A92A6;
      line-height: 1.6;
    }
    .bottom-bar {
      margin-top: 30px;
      text-align: center;
      font-size: 11px;
      color: #555E6D;
      letter-spacing: 0.5px;
    }
    .bottom-bar a {
      color: #EFA100;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header">
      <div class="brand-left">
        <img class="brand-logo" src="${GYM_LOGO_BASE64}" alt="FitVerse Elite" />
        <div>
          <div class="brand-title">${APP_NAME}</div>
          <div class="brand-tagline">${TAGLINE}</div>
        </div>
      </div>
      <div class="invoice-title-block">
        <div class="invoice-title">PAYMENT RECEIPT</div>
        <div class="receipt-no">#${data.receiptNumber}</div>
        <div><span class="paid-badge">PAID • VERIFIED</span></div>
      </div>
    </div>

    <div class="hero-amount-box">
      <div>
        <div class="amount-label">AMOUNT PAID</div>
        <div class="amount-date">Payment Date: ${data.paymentDate}</div>
      </div>
      <div class="amount-val">${formattedAmount}</div>
    </div>

    <div class="grid">
      <!-- Member Details Panel -->
      <div class="panel">
        <div class="panel-header">MEMBER INFORMATION</div>
        <div class="row">
          <span class="label">Member Name:</span>
          <span class="val">${data.memberName}</span>
        </div>
        ${data.memberId ? `
        <div class="row">
          <span class="label">Member ID:</span>
          <span class="val val-gold">${data.memberId}</span>
        </div>` : ''}
        ${data.memberMobile ? `
        <div class="row">
          <span class="label">Contact Mobile:</span>
          <span class="val">${data.memberMobile}</span>
        </div>` : ''}
      </div>

      <!-- Membership & Plan Panel -->
      <div class="panel">
        <div class="panel-header">SUBSCRIPTION & TRANSACTION</div>
        <div class="row">
          <span class="label">Plan:</span>
          <span class="val val-gold">${data.planName}</span>
        </div>
        <div class="row">
          <span class="label">Payment Mode:</span>
          <span class="val">${data.paymentMethod}</span>
        </div>
        ${data.startDate && data.endDate ? `
        <div class="row">
          <span class="label">Validity:</span>
          <span class="val">${data.startDate} to ${data.endDate}</span>
        </div>` : ''}
        ${data.transactionReference ? `
        <div class="row">
          <span class="label">Txn Ref:</span>
          <span class="val" style="font-family: monospace; font-size: 11px;">${data.transactionReference}</span>
        </div>` : ''}
      </div>
    </div>

    <div class="footer-note">
      This is an authentic computer-generated payment voucher and official proof of gym subscription fee payment at FitVerse Elite.<br>
      No signature required. Valid for entrance access during the active subscription period.
    </div>
  </div>

  <div class="bottom-bar">
    Generated via FitVerse Elite Mobile App • Powered by Chirvex (<a href="${CHIRVEX_WEBSITE}">chirvex.in</a>)
  </div>
</body>
</html>
  `.trim();
}

let isSharingReceipt = false;

/**
 * Generates the receipt PDF and shares it (allowing user to select WhatsApp to attach PDF).
 */
export async function sharePdfReceipt(receiptData: ReceiptData): Promise<void> {
  if (isSharingReceipt) {
    console.warn('[receiptPdf] A share request is already in progress, ignoring duplicate call');
    return;
  }
  isSharingReceipt = true;

  try {
    const html = generateReceiptHtml(receiptData);

    // 1. Generate official PDF file in print cache
    const { uri: tempUri, base64 } = await Print.printToFileAsync({
      html,
      base64: true,
    });

    // 2. Prepare destination in app cacheDirectory with a clean file name
    const safeReceiptNo = (receiptData.receiptNumber || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    let shareUri = tempUri;

    if (targetDir) {
      const targetUri = `${targetDir}FVE_Receipt_${safeReceiptNo}.pdf`;
      try {
        const existing = await FileSystem.getInfoAsync(targetUri);
        if (existing.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }
        await FileSystem.copyAsync({
          from: tempUri,
          to: targetUri,
        });
        shareUri = targetUri;
      } catch (copyErr) {
        console.warn('[receiptPdf] copyAsync failed, trying base64 write fallback:', copyErr);
        if (base64) {
          try {
            await FileSystem.writeAsStringAsync(targetUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            shareUri = targetUri;
          } catch (writeErr) {
            console.error('[receiptPdf] base64 write fallback failed:', writeErr);
          }
        }
      }
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(shareUri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Share Receipt #${receiptData.receiptNumber} PDF to WhatsApp`,
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg.includes('Another share request')) {
      console.warn('[receiptPdf] Suppressed duplicate Android share request:', msg);
      return;
    }
    throw err;
  } finally {
    setTimeout(() => {
      isSharingReceipt = false;
    }, 1200);
  }
}

/**
 * Opens native print preview / airprint dialog directly.
 */
export async function printPdfReceipt(receiptData: ReceiptData): Promise<void> {
  const html = generateReceiptHtml(receiptData);
  await Print.printAsync({ html });
}
