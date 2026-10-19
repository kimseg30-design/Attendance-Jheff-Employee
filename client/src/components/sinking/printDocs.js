import { numberToWords } from '../../lib/loanCalc';
import { peso, fmtDate } from '../../utils/format';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = (n) => `${numberToWords(n)} (${peso(n)})`;
function shell(title, body) {
    return `<!doctype html><html><head><title>${esc(title)}</title><style>
  body{font-family:Georgia,serif;color:#111;max-width:760px;margin:32px auto;padding:0 24px;line-height:1.55;font-size:14px}
  h1{text-align:center;font-size:20px;letter-spacing:.08em;margin-bottom:4px}.c{text-align:center}.muted{color:#555}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-family:Arial,sans-serif;font-size:12px}th,td{border:1px solid #bbb;padding:5px 6px;text-align:right}
  th{background:#f2f2f2}td:first-child,th:first-child{text-align:left}.sig{display:flex;justify-content:space-between;gap:48px;margin-top:64px}
  .sig div{flex:1;border-top:1px solid #111;text-align:center;padding-top:4px}ol li{margin-bottom:6px}@media print{body{margin:0}}
  </style></head><body>${body}<script>window.onload=()=>window.print()</script></body></html>`;
}
function open(html) {
    const w = window.open('', '_blank');
    if (!w)
        return;
    w.document.write(html);
    w.document.close();
}
const sigs = (creditor, borrower) => `<div class="sig"><div>${esc(borrower)}<br><span class="muted">Borrower</span></div><div>${esc(creditor)}<br><span class="muted">Creditor / Authorized Representative</span></div></div>`;
export function printSOA(c, s) {
    const l = c.loan;
    const rows = c.ledger.map((x) => `<tr><td>${fmtDate(x.paidOn)}</td><td>${esc(x.referenceNo)}</td><td>${peso(x.amount)}</td><td>${peso(x.interest)}</td><td>${peso(x.principal)}</td><td>${peso(x.lateFee)}</td><td>${peso(x.principalBalance)}</td><td>${peso(x.cashCollected)}</td></tr>`).join('');
    open(shell(`SOA - ${l.borrowerName}`, `<h1>STATEMENT OF ACCOUNT</h1><p class="c muted">${esc(s.creditorName)}${s.creditorAddress ? ' · ' + esc(s.creditorAddress) : ''}<br>As of ${fmtDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()))}</p>
  <p><b>Borrower:</b> ${esc(l.borrowerName)}${l.address ? ' · ' + esc(l.address) : ''}<br><b>Loan:</b> ${peso(c.basePrincipal)} at ${l.monthlyRate}% per month, ${l.termMonths} month(s), ${esc(l.frequency)} · Released ${fmtDate(l.startDate)} · Maturity ${fmtDate(c.maturity)}</p>
  <table><thead><tr><th>Date</th><th>Ref #</th><th>Paid</th><th>Interest</th><th>Principal</th><th>Late fee</th><th>Principal bal.</th><th>Cash collected</th></tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center">No payments yet</td></tr>'}</tbody></table>
  <table><tbody><tr><td>Interest charged to date</td><td>${peso(c.interestCharged)}</td></tr><tr><td>Interest paid</td><td>${peso(c.interestPaid)}</td></tr><tr><td>Principal balance</td><td>${peso(c.principalBalance)}</td></tr><tr><td>Accrued interest due</td><td>${peso(c.accruedInterest)}</td></tr>${c.pendingLateFee ? `<tr><td>Pending late fee</td><td>${peso(c.pendingLateFee)}</td></tr>` : ''}<tr><th>TOTAL AMOUNT DUE</th><th>${peso(c.balance + c.pendingLateFee)}</th></tr></tbody></table>
  ${sigs(s.creditorName, l.borrowerName)}`));
}
export function printPromissoryNote(c, s) {
    const l = c.loan;
    open(shell(`Promissory Note - ${l.borrowerName}`, `<h1>PROMISSORY NOTE</h1><p class="c muted">${peso(c.basePrincipal)} · ${fmtDate(l.startDate)}</p>
  <p>FOR VALUE RECEIVED, I, <b>${esc(l.borrowerName)}</b>${l.address ? `, of ${esc(l.address)}` : ''}, promise to pay <b>${esc(s.creditorName)}</b> the principal sum of <b>${words(c.basePrincipal)}</b>, with interest at <b>${l.monthlyRate}% per month</b>, for a term of ${l.termMonths} month(s).</p>
  <p>Payment shall be made in ${c.installments} ${esc(String(l.frequency).toLowerCase())} installment(s) of ${words(c.installment)} each, the first falling due on <b>${fmtDate(c.schedule[0])}</b> and the last on <b>${fmtDate(c.maturity)}</b>.</p>
  <ol><li>A late penalty of ${l.penaltyRate}% of the overdue amount shall be charged on any installment unpaid after a grace period of ${l.graceDays} day(s).</li>
  <li>Upon default of any installment, the entire unpaid balance may, at the option of the holder, become immediately due and demandable.</li>
  <li>The borrower may prepay all or part of this note at any time.</li>
  <li>Any action arising from this note shall be brought in the proper courts of the Philippines.</li></ol>
  ${sigs(s.creditorName, l.borrowerName)}`));
}
export function printContract(c, s) {
    const l = c.loan;
    const total = c.basePrincipal + c.monthlyInterest * c.term;
    open(shell(`Loan Agreement - ${l.borrowerName}`, `<h1>LOAN AGREEMENT</h1><p class="c muted">Executed on ${fmtDate(l.startDate)} in the Philippines</p>
  <p>This Loan Agreement is entered into by and between <b>${esc(s.creditorName)}</b>${s.creditorAddress ? `, with address at ${esc(s.creditorAddress)}` : ''} (the "LENDER"), and <b>${esc(l.borrowerName)}</b>${l.address ? `, residing at ${esc(l.address)}` : ''} (the "BORROWER").</p>
  <ol><li><b>Loan Amount.</b> The LENDER agrees to lend the BORROWER the sum of ${words(c.basePrincipal)}${l.purpose ? `, for the purpose of ${esc(l.purpose)}` : ''}.</li>
  <li><b>Interest.</b> The loan shall earn simple interest at ${l.monthlyRate}% per month, equivalent to ${words(c.monthlyInterest)} per month, for ${l.termMonths} month(s).</li>
  <li><b>Total Obligation.</b> The total amount payable is ${words(total)}.</li>
  <li><b>Repayment.</b> The BORROWER shall pay in ${c.installments} ${esc(String(l.frequency).toLowerCase())} installment(s) of ${words(c.installment)}, beginning ${fmtDate(c.schedule[0])} until ${fmtDate(c.maturity)}.</li>
  <li><b>Late Payment.</b> Installments unpaid ${l.graceDays} day(s) after their due date shall incur a penalty of ${l.penaltyRate}% of the overdue amount.</li>
  <li><b>Early Settlement.</b> The BORROWER may settle the loan early. When early settlement is granted, interest is limited to the first month.</li>
  <li><b>Default.</b> Failure to pay any installment entitles the LENDER to demand the entire outstanding balance, including accrued interest and penalties.</li>
  <li><b>Governing Law.</b> This Agreement shall be governed by the laws of the Republic of the Philippines.</li></ol>
  <p>IN WITNESS WHEREOF, the parties have signed this Agreement on the date first written above.</p>
  ${sigs(s.creditorName, l.borrowerName)}
  <div class="sig"><div>Witness</div><div>Witness</div></div>`));
}
