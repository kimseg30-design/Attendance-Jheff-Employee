import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { createEndpoint } from '../zite/backend.js';
import { requireMember } from '../lib/roles.js';
import { db } from '../lib/supabase.js';
import { withLog } from '../lib/guard.js';
import {
  getBirDeadlines,
  analyzePayrollTaxData,
  STATUTORY_MINIMUM_WAGE_DAILY,
  STATUTORY_BONUS_EXEMPT_LIMIT,
} from '../lib/birTaxEngine.js';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function parseCustomCsv(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (!cols.some(Boolean)) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });

    const basic = Number(row.basicpay || row.basic || row.rate || 0);
    const ot = Number(row.overtimepay || row.overtime || row.ot || 0);
    const holiday = Number(row.holidaypay || row.holiday || 0);
    const nd = Number(row.nightdiffpay || row.nightdiff || 0);
    const deMinimis = Number(row.deminimis || row.allowance || row.otherbenefits || 0);
    const bonus = Number(row.bonus || row.thirteenthmonth || 0);
    const sss = Number(row.sss || 0);
    const ph = Number(row.philhealth || 0);
    const pi = Number(row.pagibig || 0);
    const gross = Number(row.grosspay || row.gross || (basic + ot + holiday + nd + deMinimis + bonus));
    const tax = Number(row.withholdingtax || row.tax || row.taxwithheld || 0);

    records.push({
      employeeId: row.employeeid || row.id || `emp_${i}`,
      employeeName: row.employeename || row.name || row.employee || `Employee #${i}`,
      basicPay: basic,
      overtimePay: ot,
      holidayPay: holiday,
      nightDiffPay: nd,
      deMinimis,
      bonus,
      sss,
      philHealth: ph,
      pagIbig: pi,
      grossPay: gross,
      withholdingTax: tax,
      isMwe: Boolean(row.mwe === 'true' || row.ismwe === 'true' || (basic > 0 && basic <= STATUTORY_MINIMUM_WAGE_DAILY * 13)),
    });
  }
  return records;
}

export default createEndpoint({
  authenticated: true,
  description: 'AI-powered BIR Tax & Compliance Specialist report generation using latest BIR tax rules and Gemini 3.8 Flash',
  inputSchema: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    periodLabel: z.string().optional(),
    customPayrollText: z.string().optional(),
  }),
  outputSchema: z.object({
    systemTime: z.object({
      currentIso: z.string(),
      currentFormattedDate: z.string(),
      currentYear: z.number(),
    }),
    deadlines: z.array(z.any()),
    metrics: z.any(),
    aiAnalysis: z.string(),
  }),
  execute: withLog('generateBirTaxReport', async ({ input, context }) => {
    await requireMember(context.user, 'read');

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentFormattedDate = now.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });

    // 1. Dynamic system deadlines with weekend & holiday shifting
    const deadlines = getBirDeadlines(now);

    // 2. Fetch payroll data from DB or parse user's custom uploaded data
    let payslipData = [];
    let employeesMap = {};

    if (input.customPayrollText && input.customPayrollText.trim()) {
      payslipData = parseCustomCsv(input.customPayrollText);
      payslipData.forEach((p) => {
        employeesMap[p.employeeId] = { fullName: p.employeeName, isMwe: p.isMwe };
      });
    }

    if (!payslipData.length) {
      const [payslipsRes, empsRes] = await Promise.all([
        db.payslips.findAll({ limit: 3000 }),
        db.employees.findAll({ limit: 1000 }),
      ]);

      empsRes.records.forEach((e) => {
        employeesMap[e.id] = e;
      });

      payslipData = payslipsRes.records.filter((p) => {
        if (input.from && String(p.periodEnd || p.periodStart || '') < input.from) return false;
        if (input.to && String(p.periodStart || p.periodEnd || '') > input.to) return false;
        return true;
      });
    }

    // 3. Perform accurate mathematical baseline calculation with flexible benefits
    const metrics = analyzePayrollTaxData(payslipData, employeesMap);

    // 4. Construct prompt for Gemini 3.8 Flash model
    const systemPrompt = `You are an expert AI Payroll Specialist and Philippine Tax Accountant. Your role is to analyze the user's uploaded or inputted employee payroll data and generate comprehensive tax reports for the Bureau of Internal Revenue (BIR).

### 1. DYNAMIC SYSTEM TIME & DEADLINES
* ALWAYS check the user's current date and year: Today is ${currentFormattedDate} (Year ${currentYear}).
* Calculate and display the EXACT calendar dates for the upcoming BIR deadlines based on the current date:
  * Monthly (BIR Form 1601-C): Due on the 10th day of the following month.
  * Quarterly (BIR Form 1601-EQ / 1603Q if applicable): Due on the last day of the month following the close of the quarter.
  * Annually (BIR Form 1604-C & Alphalist / Form 2316): Due on or before January 31 of the following calendar year.
* If a deadline falls on a weekend or a Philippine national holiday, automatically note that the deadline shifts to the next working business day.

### 2. FLEXIBLE TAX CALCULATIONS & BENEFIT HANDLING
* Mandatory Benefits Handling: Check if employee contributions for SSS, PhilHealth, and Pag-IBIG are provided.
  * If PRESENT: Deduct these premium contributions from the Gross Salary first to determine the Taxable Income (since they are tax-exempt).
  * If ABSENT or ZERO: Do not throw an error. Proceed immediately to calculate the withholding tax using the Gross Salary (less any valid non-taxable allowances) as the Taxable Income base.
* Tax Computation: Apply the official and latest BIR Revised Withholding Tax Table to the computed Taxable Income.
* Employee Categorization: Automatically separate and identify Minimum Wage Earners (MWEs) who remain exempt from withholding tax on their basic pay, holiday pay, overtime pay, night shift differential, and hazard pay regardless of other inputs.
* De Minimis & Bonuses: Track non-taxable allowances (De Minimis benefits) and the 90,000 PHP threshold for 13th-month pay and other bonuses. Automatically tag amounts exceeding these thresholds as taxable income.

### 3. OUTPUT REQUIREMENTS
When the user submits their payroll data, generate a structured summary containing:
1. Executive Summary: Total Gross Compensation, Total Non-Taxable/Exempt Compensation, Total Taxable Compensation, and Total Tax Withheld for the period.
2. BIR Form Readiness Breakdown:
  * Monthly: Draft data ready for BIR Form 1601-C.
  * Quarterly: Projections or actual cumulative data for Quarterly returns.
  * Annually: Consolidated annual running totals for Form 1604-C (Alphalist tracking).
3. Actionable Alert Box: Display the countdown or exact due date for the upcoming filing period to ensure the business avoids BIR penalties (surcharges and interest).
4. No-Benefits Warning Note (Conditional): IF the payroll data contains zero or missing mandatory benefits contributions (SSS/PhilHealth/Pag-IBIG), include a brief, professional note in Tagalog/English warning the user that their taxable income and resulting BIR withholding taxes are higher because no tax-exempt government contributions were deducted.

Maintain a professional, highly precise, and reassuring tone. Always highlight that computations are based on the provided payroll numbers and standard Philippine tax rules.`;

    const userContent = `Here is the current Philippine Payroll and Tax dataset:

System Context:
- Current Date & Year: ${currentFormattedDate} (Local ISO: ${now.toISOString()})
- Coverage Period: ${input.periodLabel || (input.from && input.to ? `${input.from} to ${input.to}` : 'All active records')}
- Total Employees Processed: ${metrics.employeeCount}
- Mandatory Benefits Provided: ${metrics.statutoryContributions.hasContributions ? 'YES (SSS, PhilHealth, Pag-IBIG included)' : 'NO / ZERO CONTRIBUTIONS RECORDED'}

Aggregated Baseline Figures (PHP):
- Total Gross Compensation: ₱${metrics.totalGrossCompensation.toLocaleString()}
- Total Non-Taxable/Exempt Compensation: ₱${metrics.totalNonTaxableExempt.toLocaleString()}
- Total Taxable Compensation: ₱${metrics.totalTaxableCompensation.toLocaleString()}
- Total Tax Withheld on Compensation: ₱${metrics.totalTaxWithheld.toLocaleString()}

Mandatory Contributions (SSS, PhilHealth, Pag-IBIG):
- Total SSS: ₱${metrics.statutoryContributions.sss.toLocaleString()}
- Total PhilHealth: ₱${metrics.statutoryContributions.philHealth.toLocaleString()}
- Total Pag-IBIG: ₱${metrics.statutoryContributions.pagIbig.toLocaleString()}
- Total Statutory Deductions: ₱${metrics.statutoryContributions.total.toLocaleString()}
${!metrics.statutoryContributions.hasContributions ? '⚠️ ZERO/MISSING STATUTORY BENEFITS: Taxable income was calculated using Gross Salary less non-taxable allowances directly without government contribution deductions.' : ''}

Categorization Breakdown:
- Minimum Wage Earners (MWEs): ${metrics.mweBreakdown.count} employees (Gross: ₱${metrics.mweBreakdown.totalCompensation.toLocaleString()}, Basic: ₱${metrics.mweBreakdown.basicPay.toLocaleString()}, OT: ₱${metrics.mweBreakdown.overtimePay.toLocaleString()}, Holiday: ₱${metrics.mweBreakdown.holidayPay.toLocaleString()}, Night Diff: ₱${metrics.mweBreakdown.nightDiffPay.toLocaleString()} - 100% Tax Exempt under RA 9504)
- Regular Earners: ${metrics.regularEarners.count} employees (Taxable Base: ₱${metrics.regularEarners.taxableCompensation.toLocaleString()}, Tax Withheld: ₱${metrics.regularEarners.taxWithheld.toLocaleString()})

De Minimis & Bonus Tracking:
- Total De Minimis Benefits: ₱${metrics.deMinimisAndBonuses.totalDeMinimis.toLocaleString()}
- 13th Month & Other Bonuses: ₱${metrics.deMinimisAndBonuses.totalBonuses.toLocaleString()} (Statutory Threshold: ₱${STATUTORY_BONUS_EXEMPT_LIMIT.toLocaleString()})
- Excess Bonus Taxable: ₱${metrics.deMinimisAndBonuses.excessBonusTaxable.toLocaleString()}

Calculated Dynamic BIR Deadlines & Shifts:
${deadlines
  .map(
    (d) =>
      `- ${d.form} (${d.frequency}): Statutorily due on ${d.originalDate}. Effective deadline is ${d.dayName}, ${d.effectiveDate} (${d.daysRemaining} days remaining). ${
        d.wasShifted ? `[SHIFTED from ${d.originalDate} due to: ${d.shiftReason}]` : '[Standard Business Day]'
      }`
  )
  .join('\n')}

Please analyze this dataset thoroughly as an expert Philippine Tax Accountant and generate the comprehensive BIR Tax Report following all required sections, including the conditional No-Benefits Warning Note if applicable.`;

    let aiAnalysis = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        },
      });
      aiAnalysis = response.text || '';
    } catch (err) {
      console.error('[generateBirTaxReport] Gemini generation error:', err);
      aiAnalysis = `### Executive Summary & BIR Compliance Review

**Current Period Coverage:** ${input.periodLabel || 'Consolidated Payroll Period'}  
**Filing Status:** Active  

* **Total Gross Compensation:** ₱${metrics.totalGrossCompensation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
* **Total Non-Taxable / Exempt Compensation:** ₱${metrics.totalNonTaxableExempt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
* **Total Taxable Compensation:** ₱${metrics.totalTaxableCompensation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
* **Total Withholding Tax Required to Remit:** ₱${metrics.totalTaxWithheld.toLocaleString('en-US', { minimumFractionDigits: 2 })}

---

### BIR Form Readiness Breakdown

#### 1. Monthly Remittance Return (BIR Form 1601-C)
* **Item 14 (Total Amount of Compensation):** ₱${metrics.totalGrossCompensation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
* **Item 15 (Total Non-Taxable Compensation):** ₱${metrics.totalNonTaxableExempt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
  * Statutory SSS/PHIC/HDMF: ₱${metrics.statutoryContributions.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
  * MWE Exempt Compensation: ₱${metrics.mweBreakdown.totalCompensation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
* **Item 16 (Taxable Compensation):** ₱${metrics.totalTaxableCompensation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
* **Item 17 (Tax Required to be Withheld):** ₱${metrics.totalTaxWithheld.toLocaleString('en-US', { minimumFractionDigits: 2 })}

${
  metrics.noBenefitsWarning
    ? `> ⚠️ **PAALALA / NOTICE (No Mandatory Benefits Deducted):**  
> ${metrics.noBenefitsWarning.messageTl}  
> *English:* ${metrics.noBenefitsWarning.messageEn}`
    : ''
}

#### 2. Minimum Wage Earner (MWE) Exemption (RA 9504)
* Identified **${metrics.mweBreakdown.count}** Minimum Wage Earner(s) whose basic pay, overtime, night differential, and holiday pay are 100% exempt from income tax withholding.

#### 3. Upcoming Deadline Alert
* **BIR Form 1601-C:** Due on **${deadlines[0]?.effectiveDate}** (${deadlines[0]?.daysRemaining} days remaining). Remit on time via eFPS or authorized agent banks to avoid a 25% surcharge and 12% annual interest.`;
    }

    return {
      systemTime: {
        currentIso: now.toISOString(),
        currentFormattedDate,
        currentYear,
      },
      deadlines,
      metrics,
      aiAnalysis,
    };
  }),
});
