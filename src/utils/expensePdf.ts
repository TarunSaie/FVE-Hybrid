import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Expense } from '@/types';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { APP_NAME, TAGLINE, CHIRVEX_WEBSITE } from '@/constants/branding';
import { GYM_LOGO_BASE64 } from '@/constants/logoBase64';

export interface MonthlyExpenseExportData {
  monthStr: string; // "YYYY-MM"
  monthLabel: string; // e.g. "September 2026"
  revenue: number;
  totalExpenses: number;
  profit: number;
  expenses: Expense[];
  generatedDate: string;
}

/**
 * Generates an executive-styled HTML template for the Monthly Financial & Expense P&L Statement.
 */
export function generateMonthlyExpenseHtml(data: MonthlyExpenseExportData): string {
  const isProfit = data.profit >= 0;
  const profitMargin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : '0.0';

  // Group by category
  const categoryTotals: Record<string, number> = {};
  for (const exp of data.expenses) {
    const cat = exp.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
  }
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const categoriesHtml = sortedCategories.length > 0
    ? sortedCategories
        .map(([cat, amt]) => {
          const pct = data.totalExpenses > 0 ? ((amt / data.totalExpenses) * 100).toFixed(1) : '0.0';
          return `
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #222; color: #FFFFFF; font-weight: 600;">${cat}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #222; color: #EF4444; font-weight: 700; text-align: center;">${formatCurrency(amt)}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #222; color: #EFA100; font-weight: 700; text-align: right;">${pct}%</td>
          </tr>
        `;
        })
        .join('')
    : `
      <tr>
        <td colspan="3" style="padding: 16px; text-align: center; color: #9CA3AF;">No expenses recorded for this month.</td>
      </tr>
    `;

  // Sort expenses chronologically
  const sortedExpenses = [...data.expenses].sort((a, b) => {
    const dateA = a.expense_date || '';
    const dateB = b.expense_date || '';
    return dateA.localeCompare(dateB);
  });

  const expensesHtml = sortedExpenses.length > 0
    ? sortedExpenses
        .map(
          (exp, idx) => `
        <tr style="background: ${idx % 2 === 0 ? '#151921' : '#11141A'};">
          <td style="padding: 9px 12px; border-bottom: 1px solid #222; color: #9CA3AF; font-size: 11px;">
            ${exp.expense_date ? formatDate(exp.expense_date) : '—'}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #222; color: #FFFFFF; font-weight: 600;">
            ${exp.category}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #222; color: #BFC3C7; font-size: 11px;">
            ${(exp.description || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #222; color: #EF4444; font-weight: 700; text-align: right;">
            ${formatCurrency(exp.amount)}
          </td>
        </tr>
      `
        )
        .join('')
    : `
      <tr>
        <td colspan="4" style="padding: 18px; text-align: center; color: #9CA3AF;">No expenses recorded.</td>
      </tr>
    `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${APP_NAME} - Monthly Expense & P&L Statement</title>
  <style>
    @page {
      margin: 14mm;
      size: A4 portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0A0D12;
      color: #E6E8EA;
      margin: 0;
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      background: #11141A;
      border: 1px solid rgba(239, 161, 0, 0.35);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #1A1D24 0%, #12151B 100%);
      border-bottom: 2px solid #EFA100;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #EFA100;
      letter-spacing: 1.5px;
      margin: 0 0 3px 0;
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
      padding: 18px 22px;
      gap: 12px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .summary-card {
      flex: 1;
      background: #161A22;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 12px 14px;
      text-align: center;
    }
    .summary-card.revenue {
      border-color: rgba(34, 197, 94, 0.4);
      background: rgba(34, 197, 94, 0.05);
    }
    .summary-card.expenses {
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.05);
    }
    .summary-card.profit {
      border-color: rgba(239, 161, 0, 0.5);
      background: rgba(239, 161, 0, 0.08);
    }
    .summary-num {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 3px 0;
    }
    .summary-num.green { color: #22C55E; }
    .summary-num.red { color: #EF4444; }
    .summary-num.gold { color: #EFA100; }
    .summary-label {
      font-size: 9.5px;
      font-weight: 700;
      color: #9CA3AF;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin: 0;
    }
    .content-section {
      padding: 18px 24px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #EFA100;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 0 0 10px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: #151921;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #1E232D;
      color: #9CA3AF;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 9px 12px;
      text-align: left;
    }
    .footer {
      padding: 14px 24px;
      border-top: 1px solid rgba(255,255,255,0.08);
      text-align: center;
      font-size: 9.5px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="${GYM_LOGO_BASE64}" width="40" height="40" style="border-radius: 8px;" alt="Logo" />
        <div>
          <h1 class="brand-title">${APP_NAME}</h1>
          <p class="brand-sub">${TAGLINE}</p>
        </div>
      </div>
      <div class="report-badge">
        <div class="report-type">${data.monthLabel}</div>
        <div class="report-date">Generated: ${data.generatedDate}</div>
      </div>
    </div>

    <!-- 3-Card P&L Summary -->
    <div class="summary-grid">
      <div class="summary-card revenue">
        <div class="summary-num green">${formatCurrency(data.revenue)}</div>
        <div class="summary-label">Total Revenue</div>
      </div>
      <div class="summary-card expenses">
        <div class="summary-num red">${formatCurrency(data.totalExpenses)}</div>
        <div class="summary-label">Total Expenses</div>
      </div>
      <div class="summary-card profit">
        <div class="summary-num ${isProfit ? 'gold' : 'red'}">${formatCurrency(Math.abs(data.profit))}</div>
        <div class="summary-label">${isProfit ? 'Net Profit' : 'Net Loss'} (${profitMargin}%)</div>
      </div>
    </div>

    <!-- Category Breakdown Table -->
    <div class="content-section" style="padding-bottom: 10px;">
      <h2 class="section-title">Expense Category Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th style="text-align: center;">Total Spent</th>
            <th style="text-align: right;">% Share</th>
          </tr>
        </thead>
        <tbody>
          ${categoriesHtml}
        </tbody>
      </table>
    </div>

    <!-- Itemized Expense Transactions -->
    <div class="content-section">
      <h2 class="section-title">Itemized Expense Ledger (${data.expenses.length} Records)</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${expensesHtml}
        </tbody>
        <tfoot>
          <tr style="background: #1E232D; font-weight: 700;">
            <td colspan="3" style="padding: 10px 12px; color: #EFA100; font-size: 11px;">TOTAL OPERATING EXPENSES</td>
            <td style="padding: 10px 12px; color: #EF4444; text-align: right; font-size: 13px;">${formatCurrency(data.totalExpenses)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      FitVerse Elite Executive Financial Statement &bull; Verified Gym Records &bull; Powered by Chirvex (${CHIRVEX_WEBSITE})
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates and shares a branded PDF statement for the selected month.
 */
export async function shareMonthlyExpensePdf(data: MonthlyExpenseExportData): Promise<void> {
  const html = generateMonthlyExpenseHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Financial Statement (${data.monthLabel})`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Generates and shares an Excel-compatible CSV expense sheet for the selected month.
 */
export async function shareMonthlyExpenseSheet(data: MonthlyExpenseExportData): Promise<void> {
  const isProfit = data.profit >= 0;
  const profitMargin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : '0.0';

  // Group by category
  const categoryTotals: Record<string, number> = {};
  for (const exp of data.expenses) {
    const cat = exp.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
  }

  // Include UTF-8 BOM so Excel opens Hindi/rupee/symbols with proper encoding
  let csv = '\uFEFF';

  // Header & Month
  csv += `"${APP_NAME} - MONTHLY FINANCIAL & EXPENSE STATEMENT"\n`;
  csv += `"Month:","${data.monthLabel} (${data.monthStr})"\n`;
  csv += `"Generated:","${data.generatedDate}"\n\n`;

  // Financial KPI Summary
  csv += `"FINANCIAL PERFORMANCE SUMMARY","AMOUNT (INR)","MARGIN / NOTE"\n`;
  csv += `"Gross Revenue (Inflow)",${data.revenue},"Total Membership Inflow"\n`;
  csv += `"Total Operating Expenses",${data.totalExpenses},"Total Gym Expenditures"\n`;
  csv += `"${isProfit ? 'Net Profit' : 'Net Loss'}",${data.profit},"${profitMargin}% Margin"\n\n`;

  // Category Breakdown
  csv += `"EXPENSE CATEGORY BREAKDOWN","TOTAL SPENT (INR)","% OF EXPENSES"\n`;
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  for (const [cat, amt] of sortedCategories) {
    const pct = data.totalExpenses > 0 ? ((amt / data.totalExpenses) * 100).toFixed(1) : '0.0';
    csv += `"${cat}",${amt},"${pct}%"\n`;
  }
  csv += `"Total Across Categories",${data.totalExpenses},"100%"\n\n`;

  // Itemized Expense Ledger
  csv += `"ITEMIZED EXPENSE TRANSACTIONS"\n`;
  csv += `"#","Date","Category","Description","Amount (INR)"\n`;

  const sortedExpenses = [...data.expenses].sort((a, b) => {
    const dateA = a.expense_date || '';
    const dateB = b.expense_date || '';
    return dateA.localeCompare(dateB);
  });

  if (sortedExpenses.length === 0) {
    csv += `"1","-","No expenses recorded","-",0\n`;
  } else {
    sortedExpenses.forEach((exp, idx) => {
      const d = exp.expense_date ? formatDate(exp.expense_date) : '—';
      const c = `"${(exp.category || '').replace(/"/g, '""')}"`;
      const desc = `"${(exp.description || '—').replace(/"/g, '""')}"`;
      const amt = Number(exp.amount || 0);
      csv += `${idx + 1},"${d}",${c},${desc},${amt}\n`;
    });
  }

  csv += `\n,,,"TOTAL EXPENSES",${data.totalExpenses}\n`;

  const fileName = `FitVerse_Elite_Expenses_${data.monthStr}.csv`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Download Expense Sheet (${data.monthLabel})`,
      UTI: 'public.comma-separated-values-text',
    });
  }
}
