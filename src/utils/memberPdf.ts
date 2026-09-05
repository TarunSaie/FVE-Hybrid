import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Member, MemberWithMembership, Membership } from '@/types';
import { formatDate } from '@/utils/date';
import { APP_NAME, TAGLINE, CHIRVEX_WEBSITE } from '@/constants/branding';
import { GYM_LOGO_BASE64 } from '@/constants/logoBase64';

export interface MemberPdfData {
  memberId: string;
  fullName: string;
  mobile?: string | null;
  email?: string | null;
  gender?: string | null;
  age?: number | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  joiningDate?: string | null;
  emergencyContact?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  qrCode?: string | null;
  planName?: string | null;
  startDate?: string | null;
  expiryDate?: string | null;
  status?: string | null;
}

export function buildMemberPdfData(
  member: Member | MemberWithMembership,
  membership?: Membership | null,
  planName?: string | null
): MemberPdfData {
  const mWithM = member as MemberWithMembership;
  const plan = planName || mWithM.plan_name || (membership?.membership_plans?.name) || 'Standard Access';
  const status = mWithM.membership_status || membership?.status || 'ACTIVE';
  const start = mWithM.membership_start_date || membership?.start_date || member.joining_date;
  const expiry = mWithM.membership_expiry_date || membership?.expiry_date || null;

  return {
    memberId: member.member_id || member.id.substring(0, 8).toUpperCase(),
    fullName: member.full_name || 'Member',
    mobile: member.mobile,
    email: member.email,
    gender: member.gender,
    age: member.age,
    dateOfBirth: member.date_of_birth,
    bloodGroup: member.blood_group,
    joiningDate: member.joining_date,
    emergencyContact: member.emergency_contact,
    address: member.address,
    profilePhoto: member.profile_photo,
    qrCode: member.qr_code || member.id,
    planName: plan,
    startDate: start ? formatDate(start) : null,
    expiryDate: expiry ? formatDate(expiry) : null,
    status: status.toUpperCase(),
  };
}

export function buildMemberSubscriptionClipboardText(
  member: Member | MemberWithMembership,
  membership?: Membership | null,
  planName?: string | null
): string {
  const mWithM = member as MemberWithMembership;
  const plan = planName || mWithM.plan_name || membership?.membership_plans?.name || 'Standard Gym Access';
  const status = (mWithM.membership_status || membership?.status || 'ACTIVE').toUpperCase();
  const start = mWithM.membership_start_date || membership?.start_date || member.joining_date;
  const expiry = mWithM.membership_expiry_date || membership?.expiry_date;
  const memberId = member.member_id || 'N/A';

  let validityStr = '';
  if (start && expiry) {
    validityStr = `Validity: ${formatDate(start)} to ${formatDate(expiry)}\n`;
  } else if (start) {
    validityStr = `Joined: ${formatDate(start)}\n`;
  }

  return (
    `*${APP_NAME} Athlete Pass*\n` +
    `Member: ${member.full_name}${memberId !== 'N/A' ? ` (${memberId})` : ''}\n` +
    `Subscription: ${plan}\n` +
    `Status: ${status}\n` +
    validityStr +
    (member.mobile ? `Mobile: ${member.mobile}\n` : '') +
    (member.blood_group ? `Blood Group: ${member.blood_group}\n` : '') +
    `\n*${TAGLINE}*\n` +
    `${APP_NAME} Management (${CHIRVEX_WEBSITE})`
  );
}

export function generateMemberPassHtml(data: MemberPdfData): string {
  const statusBg =
    data.status === 'ACTIVE'
      ? 'rgba(34, 197, 94, 0.15)'
      : data.status === 'EXPIRING_SOON'
      ? 'rgba(234, 179, 8, 0.15)'
      : 'rgba(239, 68, 68, 0.15)';
  const statusBorder =
    data.status === 'ACTIVE'
      ? '#22C55E'
      : data.status === 'EXPIRING_SOON'
      ? '#EAB308'
      : '#EF4444';
  const statusColor =
    data.status === 'ACTIVE'
      ? '#4ADE80'
      : data.status === 'EXPIRING_SOON'
      ? '#FACC15'
      : '#F87171';

  const qrUrl = data.qrCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        data.qrCode
      )}&bgcolor=141820&color=EFA100`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${APP_NAME} Athlete Pass - ${data.fullName}</title>
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
      padding: 36px 40px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .pass-card {
      background: linear-gradient(145deg, #141820 0%, #0D1016 100%);
      border: 1.5px solid rgba(239, 161, 0, 0.45);
      border-radius: 20px;
      padding: 34px 38px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid rgba(239, 161, 0, 0.25);
      padding-bottom: 20px;
      margin-bottom: 24px;
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
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #EFA100;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .brand-tagline {
      font-size: 11px;
      letter-spacing: 1.5px;
      color: #8A92A6;
      text-transform: uppercase;
      font-weight: 600;
    }
    .badge-right {
      text-align: right;
    }
    .pass-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #FFFFFF;
      text-transform: uppercase;
    }
    .id-badge {
      display: inline-block;
      margin-top: 6px;
      background: rgba(239, 161, 0, 0.15);
      border: 1px solid #EFA100;
      color: #EFA100;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 8px;
      font-family: monospace;
    }

    /* Athlete Hero Profile */
    .athlete-hero {
      display: flex;
      align-items: center;
      gap: 24px;
      background: rgba(239, 161, 0, 0.05);
      border: 1px solid rgba(239, 161, 0, 0.2);
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .avatar-wrap {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 2px solid #EFA100;
      overflow: hidden;
      background: #141820;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-fallback {
      font-size: 32px;
      font-weight: 800;
      color: #EFA100;
    }
    .athlete-info {
      flex: 1;
    }
    .athlete-name {
      font-size: 24px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .status-pill {
      display: inline-block;
      background-color: ${statusBg};
      border: 1px solid ${statusBorder};
      color: ${statusColor};
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      padding: 3px 12px;
      border-radius: 20px;
      text-transform: uppercase;
    }

    /* Subscription Details Card */
    .sub-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sub-plan-name {
      font-size: 16px;
      font-weight: 700;
      color: #EFA100;
      margin-bottom: 4px;
    }
    .sub-validity {
      font-size: 12px;
      color: #BFC3C7;
    }
    .sub-validity span {
      color: #FFFFFF;
      font-weight: 600;
    }

    /* Grid Details */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 20px;
      margin-bottom: 26px;
    }
    .grid-item {
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 10px 14px;
    }
    .grid-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #8A92A6;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .grid-value {
      font-size: 13px;
      font-weight: 600;
      color: #FFFFFF;
    }

    /* QR Code Attendance Scanner Section */
    .qr-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(239, 161, 0, 0.04);
      border: 1px dashed rgba(239, 161, 0, 0.35);
      border-radius: 14px;
      padding: 18px 24px;
      margin-bottom: 24px;
    }
    .qr-info-title {
      font-size: 14px;
      font-weight: 800;
      color: #EFA100;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .qr-info-sub {
      font-size: 11px;
      color: #8A92A6;
      max-width: 320px;
      line-height: 1.4;
    }
    .qr-box {
      width: 90px;
      height: 90px;
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

    /* Footer */
    .footer {
      border-top: 1.5px solid rgba(239, 161, 0, 0.25);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left {
      font-size: 10px;
      color: #8A92A6;
      letter-spacing: 0.5px;
    }
    .footer-right {
      font-size: 10px;
      color: #8A92A6;
      text-align: right;
    }
    .footer-right a {
      color: #EFA100;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="pass-card">
    <!-- Header -->
    <div class="header">
      <div class="brand-left">
        <img src="${GYM_LOGO_BASE64}" class="brand-logo" alt="Logo" />
        <div>
          <div class="brand-title">${APP_NAME}</div>
          <div class="brand-tagline">${TAGLINE}</div>
        </div>
      </div>
      <div class="badge-right">
        <div class="pass-title">ATHLETE PASS</div>
        <div class="id-badge">${data.memberId}</div>
      </div>
    </div>

    <!-- Athlete Hero Profile -->
    <div class="athlete-hero">
      <div class="avatar-wrap">
        ${
          data.profilePhoto
            ? `<img src="${data.profilePhoto}" class="avatar-img" alt="Photo" />`
            : `<div class="avatar-fallback">${data.fullName.charAt(0).toUpperCase()}</div>`
        }
      </div>
      <div class="athlete-info">
        <div class="athlete-name">${data.fullName}</div>
        <span class="status-pill">${data.status}</span>
      </div>
    </div>

    <!-- Active Subscription -->
    <div class="sub-card">
      <div>
        <div class="sub-plan-name">${data.planName}</div>
        <div class="sub-validity">
          ${
            data.startDate && data.expiryDate
              ? `Validity: <span>${data.startDate}</span> to <span>${data.expiryDate}</span>`
              : `Enrolled on <span>${data.startDate || 'N/A'}</span>`
          }
        </div>
      </div>
    </div>

    <!-- Roster Attributes Grid -->
    <div class="grid">
      <div class="grid-item">
        <span class="grid-label">Mobile Number</span>
        <span class="grid-value">${data.mobile || '—'}</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">Email Address</span>
        <span class="grid-value">${data.email || '—'}</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">Gender / Blood Group</span>
        <span class="grid-value">${data.gender || '—'}${data.bloodGroup ? ` (${data.bloodGroup})` : ''}</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">Age / DOB</span>
        <span class="grid-value">${data.age ? `${data.age} yrs` : (data.dateOfBirth ? formatDate(data.dateOfBirth) : '—')}</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">Emergency Contact</span>
        <span class="grid-value">${data.emergencyContact || '—'}</span>
      </div>
      <div class="grid-item">
        <span class="grid-label">Registration Date</span>
        <span class="grid-value">${data.joiningDate ? formatDate(data.joiningDate) : '—'}</span>
      </div>
    </div>

    <!-- QR Code Attendance Section -->
    ${
      qrUrl
        ? `
    <div class="qr-section">
      <div>
        <div class="qr-info-title">FAST ATTENDANCE CHECK-IN</div>
        <div class="qr-info-sub">Scan this secure QR code at the front-desk terminal to record daily gym attendance.</div>
      </div>
      <div class="qr-box">
        <img src="${qrUrl}" class="qr-img" alt="QR" />
      </div>
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        FITVERSE ELITE GYM MANAGEMENT SYSTEM
      </div>
      <div class="footer-right">
        Powered by <a href="${CHIRVEX_WEBSITE}">Chirvex</a>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

let isSharingPass = false;

/**
 * Generates the official Member Pass PDF and invokes the native sharing dialog.
 */
export async function shareMemberPassPdf(data: MemberPdfData): Promise<void> {
  if (isSharingPass) {
    console.warn('[memberPdf] A share request is already in progress, ignoring duplicate call');
    return;
  }
  isSharingPass = true;

  try {
    const html = generateMemberPassHtml(data);

    // 1. Generate official PDF file in print cache
    const { uri: tempUri, base64 } = await Print.printToFileAsync({
      html,
      base64: true,
    });

    // 2. Prepare destination in app cacheDirectory with a clean file name
    const safeId = (data.memberId || 'Member').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    let shareUri = tempUri;

    if (targetDir) {
      const targetUri = `${targetDir}FVE_Pass_${safeId}.pdf`;
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
        console.warn('[memberPdf] copyAsync failed, trying base64 write fallback:', copyErr);
        if (base64) {
          try {
            await FileSystem.writeAsStringAsync(targetUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            shareUri = targetUri;
          } catch (writeErr) {
            console.error('[memberPdf] base64 write fallback failed:', writeErr);
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
      dialogTitle: `Share ${data.fullName}'s FitVerse Elite Pass PDF`,
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg.includes('Another share request')) {
      console.warn('[memberPdf] Suppressed duplicate Android share request:', msg);
      return;
    }
    throw err;
  } finally {
    setTimeout(() => {
      isSharingPass = false;
    }, 1200);
  }
}
