// Utility for printing Philippine payroll payslips accumulated 4-per-sheet on standard bond paper (Short/Letter, A4, Long/Folio)
// Designed to auto-fit bond paper sizes with 4 slips per page (2x2 grid) and dashed cutting guides.

const escapeHtml = (v) =>
  String(v ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));

const firstId = (val) => (Array.isArray(val) ? val[0] : val);

const peso = (n) => {
  const num = Number(n);
  if (isNaN(num)) return '₱0.00';
  return '₱' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(d);
  }
};

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function renderQuadrantHtml(p, { employees = [], sfMembers = [], sfCalcs = [], copyLabel = '' }) {
  const empId = firstId(p.employee || p.employeeId);
  const emp = employees.find((e) => String(e.id) === String(empId));
  
  const deductions =
    (Number(p.sss) || 0) +
    (Number(p.philHealth) || 0) +
    (Number(p.pagIbig) || 0) +
    (Number(p.withholdingTax) || 0) +
    (Number(p.loanDeductions) || 0) +
    (Number(p.cashAdvanceDeduction) || 0) +
    (Number(p.sinkingContributionDeduction) || 0) +
    (Number(p.lateDeduction) || 0);

  let details = [];
  try {
    details = JSON.parse(p.deductionDetails || '[]');
  } catch {}
  
  const sfLoans = details.filter((d) => d.source === 'sinkingFund' && !d.skipped);
  const loanLines = sfLoans.length
    ? sfLoans.map((l) => `<div class="line"><span>Loan (${escapeHtml(l.borrowerName || 'SF')})</span><b>${escapeHtml(peso(l.amount))}</b></div>`).join('')
    : (Number(p.loanDeductions) > 0 ? `<div class="line"><span>Loans</span><b>${escapeHtml(peso(p.loanDeductions))}</b></div>` : '');

  // Active loans summary (exclude fully paid)
  const mem = sfMembers.find((m) => (m.employeeId && firstId(m.employeeId) === emp?.id) || norm(m.fullName) === norm(emp?.fullName));
  const activeLoans = (sfCalcs || []).filter((c) => {
    if (c.status === 'Fully Paid' || c.balance <= 0.009) return false;
    const l = c.loan;
    const matchEmp = l.employeeId && firstId(l.employeeId) === emp?.id;
    const matchName = norm(l.borrowerName) === norm(emp?.fullName) || (mem && norm(l.borrowerName) === norm(mem.fullName));
    return matchEmp || matchName;
  });

  const activeLoansHtml = activeLoans.length > 0 ? `
    <div class="loans-summary">
      <div class="loans-title">ACTIVE LOANS (${activeLoans.length}) · PAYMENTS MADE</div>
      ${activeLoans.slice(0, 2).map((c, i) => {
        const payments = c.ledger || [];
        return `
          <div class="loan-item">
            <span>Loan #${i + 1}: ${escapeHtml(peso(c.basePrincipal))} · ${payments.length} paid (${escapeHtml(peso(c.totalCollected))})</span>
            <span>Bal: <b>${escapeHtml(peso(c.balance))}</b></span>
          </div>`;
      }).join('')}
    </div>
  ` : '';

  return `
    <article class="payslip-quadrant">
      <header class="slip-header">
        <div class="emp-info">
          <div class="comp-tag">SAHOD PAYROLL ${copyLabel ? `· <span class="copy-tag">${copyLabel}</span>` : ''}</div>
          <div class="emp-name">${escapeHtml(emp?.fullName || p.employeeName || '—')}</div>
          <div class="emp-meta">${escapeHtml(emp?.position || 'Staff')}${emp?.employeeNo ? ` · #${escapeHtml(emp.employeeNo)}` : ''}</div>
        </div>
        <div class="period-info">
          <div class="period-name">${escapeHtml(p.periodLabel || 'Coverage')}</div>
          <div class="period-dates">${escapeHtml(fmtDate(p.periodStart))} – ${escapeHtml(fmtDate(p.periodEnd))}</div>
        </div>
      </header>

      <div class="slip-body">
        <div class="col-section">
          <div class="sec-title">EARNINGS</div>
          <div class="line"><span>Days worked</span><b>${Number(p.daysWorked ?? 0)}</b></div>
          ${Number(p.daysAbsent) > 0 ? `<div class="line absent"><span>Days absent</span><b>${Number(p.daysAbsent)}</b></div>` : ''}
          <div class="line"><span>Basic pay</span><b>${escapeHtml(peso(p.basicPay))}</b></div>
          ${Number(p.overtimePay) > 0 ? `<div class="line"><span>Overtime</span><b>${escapeHtml(peso(p.overtimePay))}</b></div>` : ''}
          ${Number(p.otherBenefits) > 0 ? `<div class="line"><span>Other benefits</span><b>${escapeHtml(peso(p.otherBenefits))}</b></div>` : ''}
          ${Number(p.nightDiffPay) > 0 ? `<div class="line"><span>Night diff</span><b>${escapeHtml(peso(p.nightDiffPay))}</b></div>` : ''}
          ${Number(p.holidayPay) > 0 ? `<div class="line"><span>Holiday pay</span><b>${escapeHtml(peso(p.holidayPay))}</b></div>` : ''}
          ${Number(p.lateDeduction) > 0 ? `<div class="line late"><span>Late / undertime</span><b>−${escapeHtml(peso(p.lateDeduction))}</b></div>` : ''}
          <div class="line subtotal"><span>Gross Pay</span><b>${escapeHtml(peso(p.grossPay))}</b></div>
        </div>

        <div class="col-section">
          <div class="sec-title">DEDUCTIONS</div>
          ${Number(p.sss) > 0 ? `<div class="line"><span>SSS</span><b>${escapeHtml(peso(p.sss))}</b></div>` : ''}
          ${Number(p.philHealth) > 0 ? `<div class="line"><span>PhilHealth</span><b>${escapeHtml(peso(p.philHealth))}</b></div>` : ''}
          ${Number(p.pagIbig) > 0 ? `<div class="line"><span>Pag-IBIG</span><b>${escapeHtml(peso(p.pagIbig))}</b></div>` : ''}
          ${Number(p.withholdingTax) > 0 ? `<div class="line"><span>Withholding tax</span><b>${escapeHtml(peso(p.withholdingTax))}</b></div>` : ''}
          ${Number(p.cashAdvanceDeduction) > 0 ? `<div class="line"><span>Cash advance</span><b>${escapeHtml(peso(p.cashAdvanceDeduction))}</b></div>` : ''}
          ${Number(p.sinkingContributionDeduction) > 0 ? `<div class="line"><span>SF Contribution</span><b>${escapeHtml(peso(p.sinkingContributionDeduction))}</b></div>` : ''}
          ${loanLines}
          <div class="line subtotal"><span>Total Deductions</span><b>${escapeHtml(peso(deductions))}</b></div>
        </div>
      </div>

      ${activeLoansHtml}

      <div class="net-banner">
        <span>NET TAKE-HOME PAY</span>
        <strong>${escapeHtml(peso(p.netPay))}</strong>
      </div>

      <footer class="slip-footer">
        <div class="gov-ids">
          <span>TIN: ${escapeHtml(emp?.tin || '—')} · SSS: ${escapeHtml(emp?.sssNo || '—')}</span>
          <span>PhilHealth: ${escapeHtml(emp?.philHealthNo || '—')} · Pag-IBIG: ${escapeHtml(emp?.pagIbigNo || '—')}</span>
        </div>
        <div class="sig-box">
          <div class="sig-line">Received by / Signature & Date</div>
        </div>
      </footer>
    </article>
  `;
}

function buildBondPaperDocumentHtml({ title, barLabel, printBtnLabel, sheetsHtml }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: portrait;
      margin: 4mm 5mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 8px;
      line-height: 1.25;
      color: #0f172a;
    }
    @media print {
      html, body {
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
      .bond-sheet {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 264mm !important;
        max-height: 268mm !important;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .bond-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      z-index: 100;
    }
    .print-bar-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .print-badge {
      background: #0284c7;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .print-btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }
    .bond-sheet {
      width: 205mm;
      height: 264mm;
      margin: 14px auto;
      background: #fff;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 2.5mm;
      padding: 2mm;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
    }
    .bond-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .payslip-quadrant {
      border: 1px dashed #64748b;
      border-radius: 2.5px;
      padding: 2.2mm 2.8mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #fff;
      min-height: 0;
      box-sizing: border-box;
    }
    .payslip-quadrant.empty {
      border: 1px dashed #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
    }
    .empty-hint {
      color: #94a3b8;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: center;
    }
    .slip-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 1.2mm;
      margin-bottom: 1.2mm;
    }
    .comp-tag {
      font-size: 7.2px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0284c7;
      text-transform: uppercase;
    }
    .copy-tag {
      color: #b91c1c;
      font-weight: 800;
    }
    .emp-name {
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 58mm;
    }
    .emp-meta {
      font-size: 7px;
      color: #475569;
    }
    .period-info {
      text-align: right;
    }
    .period-name {
      font-size: 7.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .period-dates {
      font-size: 6.8px;
      color: #64748b;
    }
    .slip-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.5mm;
      flex: 1;
      min-height: 0;
    }
    .col-section {
      display: flex;
      flex-direction: column;
    }
    .sec-title {
      font-size: 7.2px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 0.4mm;
      margin-bottom: 0.6mm;
    }
    .line {
      display: flex;
      justify-content: space-between;
      gap: 1mm;
      padding: 0.3mm 0;
      font-size: 7.2px;
      color: #334155;
    }
    .line b {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
      white-space: nowrap;
    }
    .line.subtotal {
      margin-top: auto;
      border-top: 1px dashed #cbd5e1;
      padding-top: 0.6mm;
      font-weight: 700;
      color: #0f172a;
    }
    .line.subtotal b {
      font-weight: 800;
    }
    .line.absent b, .line.late b {
      color: #dc2626;
    }
    .loans-summary {
      background: #f8fafc;
      border: 0.5px solid #cbd5e1;
      border-radius: 2px;
      padding: 0.8mm 1.5mm;
      margin: 0.8mm 0;
    }
    .loans-title {
      font-size: 6.2px;
      font-weight: 800;
      color: #475569;
      margin-bottom: 0.3mm;
    }
    .loan-item {
      display: flex;
      justify-content: space-between;
      font-size: 6.2px;
      color: #475569;
    }
    .loan-item b {
      color: #0f172a;
    }
    .net-banner {
      background: #0f172a;
      color: #fff;
      border-radius: 2px;
      padding: 1.2mm 2.2mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0.8mm 0;
    }
    .net-banner span {
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .net-banner strong {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.2px;
    }
    .slip-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 0.5px dashed #cbd5e1;
      padding-top: 0.8mm;
      margin-top: 0.4mm;
    }
    .gov-ids {
      display: flex;
      flex-direction: column;
      font-size: 5.8px;
      color: #64748b;
      line-height: 1.2;
    }
    .sig-box {
      text-align: right;
    }
    .sig-line {
      width: 28mm;
      border-top: 0.5px solid #64748b;
      font-size: 5.8px;
      color: #475569;
      text-align: center;
      padding-top: 0.4mm;
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <div class="print-bar-title">
      <span>${escapeHtml(barLabel)}</span>
      <span class="print-badge">4-in-1 Bond Paper</span>
    </div>
    <button class="print-btn" onclick="window.focus(); window.print();">🖨️ ${escapeHtml(printBtnLabel)}</button>
  </div>
  ${sheetsHtml}
  <script>
    window.onload = () => {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;
}

// 4 Payslips Accumulated on 1 Bond Paper (Short/Letter, A4, Long/Folio)
export function printPayslipsBondPaper(payslipList, { employees = [], sfMembers = [], sfCalcs = [], periodLabel = '' }) {
  if (!payslipList || payslipList.length === 0) return;

  // Chunk into groups of 4 payslips per sheet of bond paper
  const sheets = [];
  for (let i = 0; i < payslipList.length; i += 4) {
    sheets.push(payslipList.slice(i, i + 4));
  }

  const sheetsHtml = sheets.map((group, pageIdx) => {
    // Fill up to 4 quadrants if last page has fewer than 4
    const quadrants = [];
    for (let q = 0; q < 4; q++) {
      if (group[q]) {
        quadrants.push(renderQuadrantHtml(group[q], { employees, sfMembers, sfCalcs }));
      } else {
        quadrants.push('<div class="payslip-quadrant empty"><div class="empty-hint">✂ Cut Sheet Placeholder</div></div>');
      }
    }

    return `
      <section class="bond-sheet">
        ${quadrants.join('')}
      </section>
    `;
  }).join('');

  const win = window.open('', '_blank', 'width=950,height=750');
  if (!win) {
    alert('Please allow pop-ups to print payslips.');
    return;
  }

  const docHtml = buildBondPaperDocumentHtml({
    title: `Payslips · 4 per Bond Paper · ${periodLabel || 'Coverage'}`,
    barLabel: `Sahod Payslips · ${payslipList.length} total slips · ${sheets.length} bond paper sheet${sheets.length === 1 ? '' : 's'}`,
    printBtnLabel: 'Print Bond Paper',
    sheetsHtml,
  });

  win.document.write(docHtml);
  win.document.close();
}

// 4 Copies of 1 Single Employee Payslip Accumulated on 1 Bond Paper
export function printSinglePayslip4Up(slip, { employees = [], sfMembers = [], sfCalcs = [] }) {
  if (!slip) return;
  const copies = [
    { ...slip, copy: 'EMPLOYEE COPY' },
    { ...slip, copy: 'ACCOUNTING COPY' },
    { ...slip, copy: 'HR / 201 FILE' },
    { ...slip, copy: 'ACKNOWLEDGEMENT' },
  ];

  const quadrants = copies.map((item) =>
    renderQuadrantHtml(item, { employees, sfMembers, sfCalcs, copyLabel: item.copy })
  );

  const sheetsHtml = `
    <section class="bond-sheet">
      ${quadrants.join('')}
    </section>
  `;

  const win = window.open('', '_blank', 'width=950,height=750');
  if (!win) {
    alert('Please allow pop-ups to print.');
    return;
  }

  const docHtml = buildBondPaperDocumentHtml({
    title: `Payslip · 4 Copies on 1 Bond Paper · ${slip.employeeName || 'Staff'}`,
    barLabel: `Payslip (${slip.employeeName || 'Staff'}) · 4 Copies on 1 Bond Paper (Employee, Accounting, HR, Acknowledgement)`,
    printBtnLabel: 'Print 4-in-1 Bond Paper',
    sheetsHtml,
  });

  win.document.write(docHtml);
  win.document.close();
}
