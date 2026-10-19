import { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Printer, Landmark, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtDate, peso, firstId } from '../utils/format';
import { useSf } from '../services/sf';
import LoanToggles from './PayslipLoanToggles';

function Line({ label, value, neg, bold }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? 'border-t pt-2 font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="num">{neg ? '−' : ''}{peso(value)}</span>
    </div>
  );
}

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function PayslipDialog({ slip, employee, onClose }) {
  const ref = useRef(null);
  const sf = useSf();
  const [local, setLocal] = useState(slip);
  const [expandedLoans, setExpandedLoans] = useState({});

  useEffect(() => setLocal(slip), [slip]);

  const s = local ?? {};
  const deductions =
    (s.sss ?? 0) +
    (s.philHealth ?? 0) +
    (s.pagIbig ?? 0) +
    (s.withholdingTax ?? 0) +
    (s.loanDeductions ?? 0) +
    (s.cashAdvanceDeduction ?? 0) +
    (s.sinkingContributionDeduction ?? 0) +
    (s.lateDeduction ?? 0);

  // Parse deduction details from payslip
  const details = useMemo(() => {
    try {
      return JSON.parse(String(s.deductionDetails || '[]'));
    } catch {
      return [];
    }
  }, [s.deductionDetails]);

  // Find Sinking Fund member corresponding to employee
  const member = useMemo(() => {
    if (!employee) return null;
    return (
      sf.members.find(
        (m) =>
          (m.employeeId && firstId(m.employeeId) === employee.id) ||
          norm(m.fullName) === norm(employee.fullName)
      ) || null
    );
  }, [sf.members, employee]);

  // Fetch ONLY ACTIVE loans belonging to this member/employee (EXCLUDE fully paid loans)
  const activeLoans = useMemo(() => {
    if (!employee) return [];
    return sf.calcs.filter((c) => {
      // Exclude fully paid loans
      if (c.status === 'Fully Paid' || c.balance <= 0.009) return false;
      const l = c.loan;
      const matchEmp = l.employeeId && firstId(l.employeeId) === employee.id;
      const matchName =
        norm(l.borrowerName) === norm(employee.fullName) ||
        (member && norm(l.borrowerName) === norm(member.fullName));
      return matchEmp || matchName;
    });
  }, [sf.calcs, employee, member]);

  // Total payments made across all active loans
  const totalActivePaymentsCount = useMemo(() => {
    return activeLoans.reduce((sum, c) => sum + (c.ledger?.length || 0), 0);
  }, [activeLoans]);

  // Active loan deduction items currently attached to this cutoff payslip
  const appliedLoans = useMemo(() => {
    return details.filter((d) => d.source === 'sinkingFund' && !d.skipped);
  }, [details]);

  const toggleExpand = (id) => {
    setExpandedLoans((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const print = () => {
    if (!ref.current) return;
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><title>Payslip</title>${styles}<style>@page{size:A4;margin:16mm}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body class="font-sans text-foreground"><div style="max-width:720px;margin:0 auto">${ref.current.innerHTML}</div></body></html>`);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    }, 500);
  };

  return (
    <Dialog open={!!slip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip</DialogTitle>
        </DialogHeader>
        <div ref={ref} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-primary p-4 text-primary-foreground">
            <div>
              <div className="text-lg font-bold">{employee?.fullName ?? '—'}</div>
              <div className="text-sm opacity-80">
                {employee?.position} · {employee?.employeeNo}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{s.periodLabel}</div>
              <div className="opacity-80">
                {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Earnings</h4>
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">Days worked</span>
                <span className="num">{s.daysWorked ?? 0}</span>
              </div>
              {Number(s.daysAbsent ?? 0) > 0 && (
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">Days absent</span>
                  <span className="num text-destructive font-medium">{s.daysAbsent}</span>
                </div>
              )}
              <Line label="Basic pay" value={s.basicPay} />
              <Line label="Overtime" value={s.overtimePay} />
              <Line label="Other benefits" value={s.otherBenefits} />
              <Line label="Night differential" value={s.nightDiffPay} />
              <Line label="Holiday / rest day" value={s.holidayPay} />
              <Line label="Late / undertime" value={s.lateDeduction} neg />
              <Line label="Gross pay" value={s.grossPay} bold />
            </div>

            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Deductions</h4>
              <Line label="SSS" value={s.sss} />
              <Line label="PhilHealth" value={s.philHealth} />
              <Line label="Pag-IBIG" value={s.pagIbig} />
              <Line label="Withholding tax" value={s.withholdingTax} />
              <Line label="Cash advances" value={s.cashAdvanceDeduction} />
              <Line label="Sinking Fund contribution (weekly)" value={s.sinkingContributionDeduction} />
              <Line label="Loans (Sinking Fund / other loans)" value={s.loanDeductions} />
              <Line label="Total deductions" value={deductions - (s.lateDeduction ?? 0)} bold />
            </div>
          </div>

          {/* ACTIVE MEMBER LOANS: SEPARATE PAYMENTS MADE BREAKDOWN */}
          {activeLoans.length > 0 && (
            <div className="rounded-xl border bg-slate-50/70 dark:bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                    Active Loans — Payments Made
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {totalActivePaymentsCount} Payments Made Total
                  </Badge>
                  {member && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Member: <b className="text-foreground">{member.fullName}</b>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {activeLoans.map((c, idx) => {
                  const applied = appliedLoans.find((d) => String(d.id) === String(c.loan.id));
                  const payments = c.ledger || [];
                  const isExpanded = expandedLoans[c.loan.id] ?? true; // expanded by default so employee sees payments immediately

                  return (
                    <div
                      key={c.loan.id}
                      className="rounded-lg border bg-card p-3 shadow-xs space-y-2.5"
                    >
                      {/* Loan Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              Loan #{idx + 1}: {c.loan.borrowerName}
                            </span>
                            <span className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded">
                              {c.loan.loanGroup || '1st Group'} · {c.loan.frequency}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {payments.length} {payments.length === 1 ? 'payment made' : 'payments made'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                            <span>Principal: <b className="text-foreground">{peso(c.basePrincipal)}</b></span>
                            <span>Total Payments Made: <b className="text-emerald-600 dark:text-emerald-400">{peso(c.totalCollected)}</b></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="text-[11px] text-muted-foreground">Cutoff Deduction:</div>
                            <div className="font-bold text-sm text-primary num">
                              {peso(applied ? applied.amount : c.installment)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 print:hidden text-muted-foreground hover:text-foreground"
                            onClick={() => toggleExpand(c.loan.id)}
                            title={isExpanded ? 'Hide payment history' : 'Show payment history'}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Itemized List of Payments Made for this specific active loan */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t text-xs">
                          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                            <span>Separate Payments Made for this Loan:</span>
                            <span>{payments.length} recorded {payments.length === 1 ? 'payment' : 'payments'}</span>
                          </div>

                          {payments.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic py-1 bg-muted/20 px-2 rounded">
                              No payments recorded yet for this active loan. First deduction applies this cutoff.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded border bg-muted/15">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-muted/50 text-muted-foreground border-b">
                                  <tr>
                                    <th className="py-1 px-2 font-medium">#</th>
                                    <th className="py-1 px-2 font-medium">Date Paid</th>
                                    <th className="py-1 px-2 font-medium text-right">Amount Paid</th>
                                    <th className="py-1 px-2 font-medium text-right">Principal</th>
                                    <th className="py-1 px-2 font-medium text-right">Interest</th>
                                    <th className="py-1 px-2 font-medium">Reference</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payments.map((p, pIdx) => (
                                    <tr key={p.id || pIdx} className="border-b last:border-0 hover:bg-muted/30">
                                      <td className="py-1 px-2 font-semibold text-muted-foreground">{pIdx + 1}</td>
                                      <td className="py-1 px-2 font-medium">{fmtDate(p.paidOn)}</td>
                                      <td className="py-1 px-2 text-right font-bold text-emerald-700 dark:text-emerald-400 num">
                                        {peso(p.amount)}
                                      </td>
                                      <td className="py-1 px-2 text-right num text-muted-foreground">{peso(p.principal)}</td>
                                      <td className="py-1 px-2 text-right num text-muted-foreground">{peso(p.interest)}</td>
                                      <td className="py-1 px-2 text-[10px] text-muted-foreground truncate max-w-[140px]">
                                        {p.referenceNo ? p.referenceNo.replace(/PAYSLIP-[a-f0-9-]+-/, 'Payslip ') : 'Payment'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <span>Fully paid loans are excluded from this payslip view.</span>
                <span>Combined Active Payments Made: <b className="text-foreground">{totalActivePaymentsCount} payments</b></span>
              </div>
            </div>
          )}

          {s.status === 'Draft' && s.id && <LoanToggles slip={s} onChange={setLocal} />}

          <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-accent/40 px-4 py-3">
            <span className="font-semibold">Net Pay</span>
            <span className="num text-2xl font-bold text-primary">{peso(s.netPay)}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            TIN {employee?.tin || '—'} · SSS {employee?.sssNo || '—'} · PhilHealth {employee?.philHealthNo || '—'} · Pag-IBIG {employee?.pagIbigNo || '—'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={print}>
            <Printer className="mr-2 h-4 w-4" />Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
