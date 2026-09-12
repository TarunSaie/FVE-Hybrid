import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/api/supabase';
import { Payment, PersonalTraining } from '@/types';
import { formatCurrency, openWhatsAppLink } from '@/utils/format';
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
  durationDays?: number | null;
  memberQrCode?: string | null;
  transactionReference?: string | null;
  isPersonalTraining?: boolean;
  trainerName?: string | null;
  totalSessions?: number | null;
  serviceType?: string;
  visitDayLimit?: number | null;
  visitDaysUsed?: number | null;
  actualVisitsUsed?: number | null;
  remainingVisits?: number | null;
  actualPTSessionsCompleted?: number | null;
  remainingPTSessions?: number | null;
}

export function buildReceiptDataFromPayment(
  payment: Payment,
  pt?: PersonalTraining | null,
  usageStats?: {
    actualVisitsUsed?: number | null;
    remainingVisits?: number | null;
    actualPTSessionsCompleted?: number | null;
    remainingPTSessions?: number | null;
  }
): ReceiptData {
  const memberName = payment.members?.full_name || 'Member';
  const memberMobile = payment.members?.mobile;
  const memberId = payment.members?.member_id;
  const plan = payment.memberships?.membership_plans;

  const isPT = Boolean(pt || payment.notes?.includes('Personal Training'));

  let planName = plan?.name || 'Gym Membership';
  let startDate = payment.memberships?.start_date ? formatDate(payment.memberships.start_date) : null;
  let endDate = payment.memberships?.expiry_date ? formatDate(payment.memberships.expiry_date) : null;
  let durationDays =
    plan?.duration_days ||
    (payment.memberships?.start_date && payment.memberships?.expiry_date
      ? Math.max(
          1,
          Math.round(
            (new Date(payment.memberships.expiry_date).getTime() -
              new Date(payment.memberships.start_date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null);

  let trainerName: string | null = null;
  let totalSessions: number | null = null;

  if (isPT) {
    if (pt) {
      planName = `Personal Training — ${pt.package_name}`;
      trainerName = pt.trainer?.full_name || null;
      totalSessions = pt.total_sessions;
      if (pt.start_date) startDate = formatDate(pt.start_date);
      if (pt.expiry_date) endDate = formatDate(pt.expiry_date);
      if (pt.start_date && pt.expiry_date) {
        durationDays = Math.max(
          1,
          Math.round(
            (new Date(pt.expiry_date).getTime() - new Date(pt.start_date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
      }
    } else {
      planName = 'Personal Training Add-On';
    }
  }

  const receiptNo = payment.receipt_number || 'FVE-N/A';
  const dateStr = formatDate(payment.payment_date || payment.created_at);
  const memberQrCode = payment.members?.qr_code || payment.members?.id || payment.member_id || null;
  const visitDayLimit = payment.memberships?.visit_day_limit ?? null;
  const visitDaysUsed = payment.memberships?.visit_days_used ?? 0;

  const actualVisits = usageStats?.actualVisitsUsed ?? visitDaysUsed;
  const remainingVis = usageStats?.remainingVisits ?? (visitDayLimit != null ? Math.max(0, visitDayLimit - actualVisits) : null);

  const actualPTCompleted = usageStats?.actualPTSessionsCompleted ?? pt?.sessions_completed ?? 0;
  const remainingPT = usageStats?.remainingPTSessions ?? (totalSessions != null ? Math.max(0, totalSessions - actualPTCompleted) : null);

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
    durationDays,
    memberQrCode,
    transactionReference: payment.transaction_reference,
    isPersonalTraining: isPT,
    trainerName,
    totalSessions,
    serviceType: isPT ? 'PERSONAL TRAINING ADD-ON' : 'GYM MEMBERSHIP',
    visitDayLimit,
    visitDaysUsed,
    actualVisitsUsed: actualVisits,
    remainingVisits: remainingVis,
    actualPTSessionsCompleted: actualPTCompleted,
    remainingPTSessions: remainingPT,
  };
}

export function generateReceiptHtml(data: ReceiptData): string {
  const formattedAmount = formatCurrency(data.amount);
  const qrUrl = data.memberQrCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        data.memberQrCode
      )}&bgcolor=141820&color=EFA100`
    : '';

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
    .duration-tag {
      font-size: 11px;
      color: #8A92A6;
    }
    .qr-attendance-panel {
      background: rgba(239, 161, 0, 0.04);
      border: 1.5px dashed rgba(239, 161, 0, 0.35);
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      gap: 16px;
    }
    .qr-attendance-info {
      flex: 1;
    }
    .qr-attendance-title {
      font-size: 13px;
      font-weight: 800;
      color: #EFA100;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .qr-attendance-sub {
      font-size: 11px;
      color: #8A92A6;
      line-height: 1.4;
      margin-bottom: 6px;
    }
    .qr-validity-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      color: #4ADE80;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 4px;
      padding: 2px 8px;
      letter-spacing: 0.5px;
    }
    .qr-box-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
    }
    .qr-box {
      width: 86px;
      height: 86px;
      border-radius: 10px;
      border: 1.5px solid #EFA100;
      background: #141820;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .qr-label {
      font-size: 9px;
      color: #EFA100;
      font-weight: 700;
      font-family: monospace;
      margin-top: 4px;
      letter-spacing: 0.5px;
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
        <div class="invoice-title">${data.isPersonalTraining ? 'PERSONAL TRAINING RECEIPT' : 'PAYMENT RECEIPT'}</div>
        <div class="receipt-no">#${data.receiptNumber}</div>
        <div>
          <span class="paid-badge" style="${data.isPersonalTraining ? 'background-color: rgba(239, 161, 0, 0.15); border: 1px solid #EFA100; color: #EFA100;' : ''}">
            ${data.isPersonalTraining ? 'PT ADD-ON • VERIFIED' : 'PAID • VERIFIED'}
          </span>
        </div>
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

      <!-- Membership / PT Plan Panel -->
      <div class="panel">
        <div class="panel-header">${data.isPersonalTraining ? 'PERSONAL TRAINING DETAILS' : 'SUBSCRIPTION & TRANSACTION'}</div>
        ${data.isPersonalTraining ? `
        <div class="row">
          <span class="label">Service:</span>
          <span class="val val-gold">Personal Training Add-On</span>
        </div>
        <div class="row">
          <span class="label">Package:</span>
          <span class="val val-gold">${data.planName}</span>
        </div>
        ${data.trainerName ? `
        <div class="row">
          <span class="label">Assigned Trainer:</span>
          <span class="val">${data.trainerName}</span>
        </div>` : ''}
        ${data.totalSessions ? `
        <div class="row">
          <span class="label">Sessions Allotted:</span>
          <span class="val val-gold">${data.totalSessions} Guided Sessions</span>
        </div>
        <div style="font-size: 10px; color: #8A92A6; margin-top: 4px; margin-bottom: 6px; line-height: 1.4;">
          <div>Sessions: ${data.totalSessions} sessions allotted throughout your entire subscription period.</div>
          <div style="color: #EFA100; font-weight: 600; margin-top: 2px;">
            ${data.actualPTSessionsCompleted ?? 0}/${data.totalSessions} sessions completed. ${(data.remainingPTSessions ?? (data.totalSessions - (data.actualPTSessionsCompleted ?? 0))) > 1 ? `You can attend ${data.remainingPTSessions ?? (data.totalSessions - (data.actualPTSessionsCompleted ?? 0))} more sessions during your plan.` : (data.remainingPTSessions ?? (data.totalSessions - (data.actualPTSessionsCompleted ?? 0))) === 1 ? `You can attend 1 more session during your plan.` : `All allotted sessions have been completed.`}
          </div>
        </div>` : ''}
        ${data.startDate && data.endDate ? `
        <div class="row">
          <span class="label">PT Validity:</span>
          <span class="val">${data.startDate} to ${data.endDate}</span>
        </div>` : ''}
        ${data.durationDays ? `
        <div class="row">
          <span class="label">Duration:</span>
          <span class="val duration-tag">${data.durationDays} Days PT Validity</span>
        </div>` : ''}
        ` : `
        <div class="row">
          <span class="label">Plan:</span>
          <span class="val val-gold">${data.planName}</span>
        </div>
        ${data.startDate && data.endDate ? `
        <div class="row">
          <span class="label">Validity:</span>
          <span class="val">${data.startDate} to ${data.endDate}</span>
        </div>` : ''}
        ${data.durationDays ? `
        <div class="row">
          <span class="label">Duration:</span>
          <span class="val duration-tag">${data.durationDays} Days Membership</span>
        </div>` : ''}
        ${data.visitDayLimit != null ? `
        <div class="row">
          <span class="label">Visits Allotted:</span>
          <span class="val val-gold">${data.visitDayLimit} Days</span>
        </div>
        <div style="font-size: 10px; color: #8A92A6; margin-top: 4px; margin-bottom: 6px; line-height: 1.4;">
          <div>Visits: ${data.visitDayLimit} days allotted throughout your entire subscription period.</div>
          <div style="color: #EFA100; font-weight: 600; margin-top: 2px;">
            ${data.actualVisitsUsed ?? data.visitDaysUsed ?? 0}/${data.visitDayLimit} visits used. ${(data.remainingVisits ?? (data.visitDayLimit - (data.actualVisitsUsed ?? data.visitDaysUsed ?? 0))) > 1 ? `You can visit for ${data.remainingVisits ?? (data.visitDayLimit - (data.actualVisitsUsed ?? data.visitDaysUsed ?? 0))} more days during your plan.` : (data.remainingVisits ?? (data.visitDayLimit - (data.actualVisitsUsed ?? data.visitDaysUsed ?? 0))) === 1 ? `You can visit for 1 more day during your plan.` : `All allotted visit days have been used.`}
          </div>
        </div>` : ''}
        `}
        <div class="row">
          <span class="label">Payment Mode:</span>
          <span class="val">${data.paymentMethod}</span>
        </div>
        ${data.transactionReference ? `
        <div class="row">
          <span class="label">Txn Ref:</span>
          <span class="val" style="font-family: monospace; font-size: 11px;">${data.transactionReference}</span>
        </div>` : ''}
      </div>
    </div>

    ${qrUrl ? `
    <div class="qr-attendance-panel">
      <div class="qr-attendance-info">
        <div class="qr-attendance-title">${data.isPersonalTraining ? 'MEMBER ATTENDANCE & PT QR CODE' : 'MEMBER ATTENDANCE QR CODE'}</div>
        <div class="qr-attendance-sub">${data.isPersonalTraining ? 'Present this digital QR code at the gym front-desk kiosk to verify subscription and 1-on-1 personal training validity.' : 'Present this digital QR code at the gym front-desk kiosk to verify subscription validity and record daily attendance.'}</div>
        ${data.startDate && data.endDate ? `<div class="qr-validity-badge">VALIDITY: ${data.startDate} — ${data.endDate}</div>` : ''}
      </div>
      <div class="qr-box-wrap">
        <div class="qr-box">
          <img src="${qrUrl}" class="qr-img" alt="Member QR Code" />
        </div>
        <div class="qr-label">${data.memberId || 'ATTENDANCE QR'}</div>
      </div>
    </div>
    ` : ''}

    <div class="footer-note">
      This is an authentic computer-generated payment voucher and official proof of ${data.isPersonalTraining ? 'personal training add-on service fee payment' : 'gym subscription fee payment'} at FitVerse Elite.<br>
      No signature required. Valid for entrance access and session tracking during the active period.
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

/**
 * Generates and uploads the receipt PDF to Supabase Storage, returning a public URL.
 * Automatically falls back between 'receipts' and 'member-images' storage buckets.
 */
export async function uploadReceiptPdf(receiptData: ReceiptData): Promise<string | null> {
  try {
    const html = generateReceiptHtml(receiptData);
    const { uri } = await Print.printToFileAsync({ html });

    const safeReceiptNo = (receiptData.receiptNumber || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `FVE_Receipt_${safeReceiptNo}_${Date.now()}.pdf`;

    const response = await fetch(uri);
    const blob = await response.blob();

    // 1. Try uploading to 'receipts' bucket
    let bucket = 'receipts';
    const uploadRes = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, { contentType: 'application/pdf', upsert: true });

    // 2. If 'receipts' bucket is missing or errors, fallback to 'member-images'
    if (uploadRes.error) {
      bucket = 'member-images';
      const fallbackPath = `receipts/${fileName}`;
      const fallbackRes = await supabase.storage
        .from(bucket)
        .upload(fallbackPath, blob, { contentType: 'application/pdf', upsert: true });

      if (!fallbackRes.error) {
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fallbackPath);
        return pubData?.publicUrl || null;
      }
    } else {
      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return pubData?.publicUrl || null;
    }

    return null;
  } catch (err) {
    console.warn('[uploadReceiptPdf] Failed to upload PDF to cloud storage:', err);
    return null;
  }
}

/**
 * Builds the official WhatsApp text receipt message, including optional cloud PDF invoice link.
 */
export function buildWhatsAppReceiptMessage(receiptData: ReceiptData, pdfUrl?: string | null): string {
  const isPT = receiptData.isPersonalTraining;
  const validityLine =
    receiptData.startDate && receiptData.endDate
      ? `• Validity: *${receiptData.startDate} TO ${receiptData.endDate}*\n`
      : '';

  let details = '';
  if (isPT) {
    details =
      `• Service: *Personal Training Add-On*\n` +
      `• Package: *${receiptData.planName}*\n` +
      (receiptData.trainerName ? `• Trainer: *${receiptData.trainerName}*\n` : '') +
      (receiptData.totalSessions ? `• Total Sessions: *${receiptData.totalSessions} Sessions*\n` : '') +
      validityLine;
  } else {
    details =
      `• Plan: *${receiptData.planName}*\n` +
      validityLine +
      (receiptData.visitDayLimit != null ? `• Visits Allotted: *${receiptData.visitDayLimit} Days*\n` : '');
  }

  const pdfLine = pdfUrl
    ? `\n📄 *Official PDF Invoice:*\n${pdfUrl}\n`
    : '';

  return (
    `*FitVerse Elite Official Receipt*\n` +
    `• Receipt No: *#${receiptData.receiptNumber}*\n` +
    `• Member: *${receiptData.memberName}*${receiptData.memberId ? ` (${receiptData.memberId})` : ''}\n` +
    details +
    `• Amount Paid: *${formatCurrency(receiptData.amount)}*\n` +
    `• Payment Method: *${(receiptData.paymentMethod || 'CASH').toUpperCase()}*\n` +
    `• Date: *${receiptData.paymentDate}*\n` +
    pdfLine +
    `\n*DISCIPLINE • STRENGTH • TRANSFORMATION*\n` +
    `FitVerse Elite Gym Management\n` +
    `Powered by Chirvex (https://chirvex.in/)`
  );
}

/**
 * Direct 1-tap WhatsApp sharing to the member's registered mobile number:
 * 1. Uploads branded PDF to Supabase Storage to obtain public URL.
 * 2. Pre-fills official receipt message with the PDF link.
 * 3. Copies message to clipboard as backup.
 * 4. Opens WhatsApp directly in chat with member's number via wa.me.
 */
export async function directShareReceiptToWhatsApp(
  receiptData: ReceiptData,
  phoneOverride?: string | null
): Promise<{ success: boolean; hasPhone: boolean; pdfUrl: string | null }> {
  const targetPhone = phoneOverride || receiptData.memberMobile;
  if (!targetPhone) {
    return { success: false, hasPhone: false, pdfUrl: null };
  }

  // 1. Upload PDF to cloud storage to get link
  const pdfUrl = await uploadReceiptPdf(receiptData);

  // 2. Build full formatted message
  const msg = buildWhatsAppReceiptMessage(receiptData, pdfUrl);

  // 3. Copy to clipboard
  try {
    await Clipboard.setStringAsync(msg);
  } catch {
    // Ignore clipboard error
  }

  // 4. Open WhatsApp directly into the chat with the member's number
  await openWhatsAppLink(targetPhone, msg);

  return { success: true, hasPhone: true, pdfUrl };
}

