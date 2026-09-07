import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { APP_NAME, TAGLINE, CHIRVEX_WEBSITE } from '@/constants/branding';
import { GYM_LOGO_BASE64 } from '@/constants/logoBase64';

export interface ReportPdfData {
  periodLabel: string;
  generatedDate: string;
  totalRevenue: number;
  averageRevenue: number;
  bars: { label: string; revenue: number }[];
  memberStats?: {
    active: number;
    expiring: number;
    expired: number;
    total: number;
  };
  popularPlans?: {
    name: string;
    price: number;
    count: number;
  }[];
}

export function generateReportHtml(data: ReportPdfData): string {
  const barsHtml = data.bars
    .map(
      b => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #222; color: #E0E0E0; font-weight: 600;">${b.label}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #222; color: #EFA100; font-weight: 700; text-align: right;">${formatCurrency(b.revenue)}</td>
      </tr>
    `
    )
    .join('');

  const plansHtml = (data.popularPlans || [])
    .map(
      p => `
      <tr>
        <td style="padding: 8px 14px; border-bottom: 1px solid #222; color: #E0E0E0;">${p.name}</td>
        <td style="padding: 8px 14px; border-bottom: 1px solid #222; color: #BFC3C7; text-align: center;">${formatCurrency(p.price)}</td>
        <td style="padding: 8px 14px; border-bottom: 1px solid #222; color: #EFA100; font-weight: 700; text-align: right;">${p.count} members</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${APP_NAME} - Business Performance Report</title>
  <style>
    @page {
      margin: 16mm;
      size: A4 portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0A0D12;
      color: #E6E8EA;
      margin: 0;
      padding: 24px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      background: #11141A;
      border: 1px solid rgba(239, 161, 0, 0.35);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #1A1D24 0%, #12151B 100%);
      border-bottom: 2px solid #EFA100;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #EFA100;
      letter-spacing: 1.5px;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 11px;
      color: #9CA3AF;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .report-badge {
      background: rgba(239, 161, 0, 0.12);
      border: 1px solid rgba(239, 161, 0, 0.4);
      padding: 6px 14px;
      border-radius: 20px;
      text-align: right;
    }
    .report-type {
      font-size: 12px;
      font-weight: 800;
      color: #EFA100;
      text-transform: uppercase;
    }
    .report-date {
      font-size: 10px;
      color: #9CA3AF;
      margin-top: 2px;
    }
    .summary-grid {
      display: flex;
      padding: 20px;
      gap: 12px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .summary-card {
      flex: 1;
      background: #161A22;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }
    .summary-card.highlight {
      border-color: rgba(239, 161, 0, 0.5);
      background: rgba(239, 161, 0, 0.05);
    }
    .summary-num {
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
      margin: 0 0 4px 0;
    }
    .summary-num.gold {
      color: #EFA100;
    }
    .summary-label {
      font-size: 10px;
      font-weight: 700;
      color: #9CA3AF;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin: 0;
    }
    .content-section {
      padding: 20px 24px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #EFA100;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      background: #151921;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #1E232D;
      color: #9CA3AF;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 10px 14px;
      text-align: left;
    }
    th:last-child {
      text-align: right;
    }
    .footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255,255,255,0.08);
      text-align: center;
      font-size: 10px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${GYM_LOGO_BASE64}" width="42" height="42" style="border-radius: 8px;" alt="Logo" />
        <div>
          <h1 class="brand-title">${APP_NAME}</h1>
          <p class="brand-sub">${TAGLINE}</p>
        </div>
      </div>
      <div class="report-badge">
        <div class="report-type">${data.periodLabel}</div>
        <div class="report-date">Generated: ${data.generatedDate}</div>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="summary-grid">
      <div class="summary-card highlight">
        <div class="summary-num gold">${formatCurrency(data.totalRevenue)}</div>
        <div class="summary-label">Total Revenue</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">${formatCurrency(data.averageRevenue)}</div>
        <div class="summary-label">Avg / Period</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">${data.memberStats?.active || 0}</div>
        <div class="summary-label">Active Members</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">${data.memberStats?.total || 0}</div>
        <div class="summary-label">Roster Total</div>
      </div>
    </div>

    <!-- Revenue Breakdown Table -->
    <div class="content-section">
      <h2 class="section-title">Revenue Breakdown (${data.periodLabel})</h2>
      <table>
        <thead>
          <tr>
            <th>Period Interval</th>
            <th style="text-align: right;">Total Inflow</th>
          </tr>
        </thead>
        <tbody>
          ${barsHtml}
        </tbody>
      </table>
    </div>

    ${
      (data.popularPlans || []).length > 0
        ? `
    <!-- Top Plans Section -->
    <div class="content-section" style="padding-top: 0;">
      <h2 class="section-title">Top Membership Tiers</h2>
      <table>
        <thead>
          <tr>
            <th>Plan Name</th>
            <th style="text-align: center;">Price</th>
            <th style="text-align: right;">Subscribed Members</th>
          </tr>
        </thead>
        <tbody>
          ${plansHtml}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      FitVerse Elite Executive Management Report &bull; Verified Gym Records &bull; Powered by Chirvex (${CHIRVEX_WEBSITE})
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates and opens native share sheet for the report PDF.
 */
export async function shareReportPdf(data: ReportPdfData): Promise<void> {
  const html = generateReportHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${data.periodLabel}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Triggers native system printing dialog for the report.
 */
export async function printReportPdf(data: ReportPdfData): Promise<void> {
  const html = generateReportHtml(data);
  await Print.printAsync({ html });
}
