import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/shared/ui/alert-dialog';
import { Eye, ListChecks, Play, Printer, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import PayslipDialog from '../components/PayslipDialog';
import GeneratePayrollDialog from '../components/GeneratePayrollDialog';
import { useDeleteRecord, useNameMap, useRecords } from '../services/records';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { releasePayslips } from '@/zite/api';
import { useRole } from '../services/role';
import { useSf } from '../services/sf';
import { firstId, fmtDate, peso } from '../utils/format';
const money = (key, header) => ({ accessorKey: key, header, cell: ({ getValue }) => <span className="num">{peso(getValue())}</span> });
export default function PayrollPage() {
    const { data = [], isLoading } = useRecords('payslips');
    const emps = useNameMap('employees');
    const sf = useSf();
    const del = useDeleteRecord('payslips');
    const [period, setPeriod] = useState('all');
    const [viewing, setViewing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [bulkDeleting, setBulkDeleting] = useState(null);
    const [clearBulkSelection, setClearBulkSelection] = useState(null);
    const [genOpen, setGenOpen] = useState(false);
    const periods = useMemo(() => [...new Set(data.map((p) => p.periodLabel).filter(Boolean))], [data]);
    const rows = useMemo(() => data.filter((p) => period === 'all' || p.periodLabel === period), [data, period]);
    const totals = useMemo(() => rows.reduce((a, p) => ({ gross: a.gross + (p.grossPay ?? 0), net: a.net + (p.netPay ?? 0), gov: a.gov + (p.sss ?? 0) + (p.philHealth ?? 0) + (p.pagIbig ?? 0), tax: a.tax + (p.withholdingTax ?? 0) }), { gross: 0, net: 0, gov: 0, tax: 0 }), [rows]);
    const drafts = rows.filter((p) => p.status !== 'Released');
    const releasedRows = rows.filter((p) => p.status === 'Released');
    const printReleasedCoverage = useCallback(() => {
        if (period === 'all' || releasedRows.length === 0) {
            toast.error('Select a specific coverage with released payslips first.');
            return;
        }
        const escapeHtml = (v) => String(v ?? '—').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c] ?? c));
        const line = (label, value, negative = false) => `<div class="line"><span>${escapeHtml(label)}</span><b>${negative && Number(value) > 0 ? '−' : ''}${escapeHtml(peso(value))}</b></div>`;
        const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

        const renderSlip = (p) => {
            const emp = emps.list.find((e) => e.id === firstId(p.employee));
            const deductions = (Number(p.sss) || 0) + (Number(p.philHealth) || 0) + (Number(p.pagIbig) || 0) + (Number(p.withholdingTax) || 0) + (Number(p.loanDeductions) || 0) + (Number(p.cashAdvanceDeduction) || 0) + (Number(p.sinkingContributionDeduction) || 0) + (Number(p.lateDeduction) || 0);
            let details = [];
            try { details = JSON.parse(p.deductionDetails || '[]'); } catch {}
            const sfLoans = details.filter((d) => d.source === 'sinkingFund' && !d.skipped);
            const loanLines = sfLoans.length
                ? sfLoans.map((l) => line(`Loan payment (${l.borrowerName || 'SF Loan'})`, l.amount)).join('')
                : (Number(p.loanDeductions) > 0 ? line('Loans', p.loanDeductions) : '');

            // Member active loans & separate payments made (exclude fully paid)
            const mem = sf.members.find((m) => (m.employeeId && firstId(m.employeeId) === emp?.id) || norm(m.fullName) === norm(emp?.fullName));
            const activeLoans = sf.calcs.filter((c) => {
                if (c.status === 'Fully Paid' || c.balance <= 0.009) return false;
                const l = c.loan;
                const matchEmp = l.employeeId && firstId(l.employeeId) === emp?.id;
                const matchName = norm(l.borrowerName) === norm(emp?.fullName) || (mem && norm(l.borrowerName) === norm(mem.fullName));
                return matchEmp || matchName;
            });

            const activePaymentsTotal = activeLoans.reduce((sum, c) => sum + (c.ledger?.length || 0), 0);

            const activeLoansHtml = activeLoans.length > 0 ? `
                <section style="margin-top:1.5mm;border-top:1px dashed #000;padding-top:1mm;">
                    <div style="font-weight:bold;font-size:7.5px;margin-bottom:0.8mm;">ACTIVE LOANS &amp; PAYMENTS (${activePaymentsTotal})</div>
                    ${activeLoans.map((c, i) => {
                        const payments = c.ledger || [];
                        const applied = sfLoans.find((d) => String(d.id) === String(c.loan.id));
                        return `
                        <div style="margin-bottom:1mm;padding:0.5mm 0;border-bottom:0.5px dotted #999;font-size:7px;">
                            <div style="font-weight:bold;">Loan #${i + 1}: ${escapeHtml(c.loan.borrowerName)} (${escapeHtml(c.loan.loanGroup || '1st Group')})</div>
                            <div style="color:#444;">Principal: ${escapeHtml(peso(c.basePrincipal))} · Paid: <b>${payments.length} (${escapeHtml(peso(c.totalCollected))})</b></div>
                            ${payments.slice(-3).map((pm, pidx) => `
                                <div style="display:flex;justify-content:space-between;color:#555;padding-left:1.5mm;font-size:6.5px;">
                                    <span>#${pidx + 1} (${escapeHtml(fmtDate(pm.paidOn))})</span>
                                    <span>${escapeHtml(peso(pm.amount))}</span>
                                </div>
                            `).join('')}
                            <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:0.5mm;">
                                <span>Cutoff deduction:</span>
                                <span>${escapeHtml(peso(applied ? applied.amount : c.installment))}</span>
                            </div>
                        </div>`;
                    }).join('')}
                </section>
            ` : '';

            return `
            <div class="slip-cell">
              <article class="slip">
                <header>
                  <h2>PAYSLIP</h2>
                  <div class="name">${escapeHtml(emp?.fullName ?? '—')}</div>
                  <div class="emp-meta">${escapeHtml(emp?.position ?? '')}${emp?.employeeNo ? ` · ${escapeHtml(emp.employeeNo)}` : ''}</div>
                  <div class="period">${escapeHtml(p.periodLabel)}<br>${escapeHtml(fmtDate(p.periodStart))} – ${escapeHtml(fmtDate(p.periodEnd))}</div>
                </header>
                <section>
                  <h3>EARNINGS</h3>
                  ${line('Days worked', p.daysWorked)}
                  ${Number(p.daysAbsent) > 0 ? line('Days absent', p.daysAbsent) : ''}
                  ${line('Basic pay', p.basicPay)}
                  ${line('Overtime', p.overtimePay)}
                  ${line('Other benefits', p.otherBenefits)}
                  ${line('Night differential', p.nightDiffPay)}
                  ${line('Holiday / rest day', p.holidayPay)}
                  ${line('Late / undertime', p.lateDeduction, true)}
                  ${line('Gross pay', p.grossPay)}
                </section>
                <section>
                  <h3>DEDUCTIONS</h3>
                  ${line('SSS', p.sss)}
                  ${line('PhilHealth', p.philHealth)}
                  ${line('Pag-IBIG', p.pagIbig)}
                  ${line('Withholding tax', p.withholdingTax)}
                  ${line('Cash advances', p.cashAdvanceDeduction)}
                  ${line('Sinking Fund contribution', p.sinkingContributionDeduction)}
                  ${loanLines}
                  ${line('Total deductions', deductions)}
                </section>
                ${activeLoansHtml}
                <div class="net">
                  <span>NET PAY</span>
                  <strong>${escapeHtml(peso(p.netPay))}</strong>
                </div>
                <footer>
                  TIN ${escapeHtml(emp?.tin || '—')}<br>
                  SSS ${escapeHtml(emp?.sssNo || '—')}<br>
                  PhilHealth ${escapeHtml(emp?.philHealthNo || '—')} · Pag-IBIG ${escapeHtml(emp?.pagIbigNo || '—')}
                </footer>
              </article>
            </div>`;
        };

        const pages = [];
        for (let i = 0; i < releasedRows.length; i += 4) {
            pages.push(releasedRows.slice(i, i + 4));
        }

        const sheetsHtml = pages.map((pageRows) => {
            const cells = pageRows.map(renderSlip).join('');
            return `<div class="bondpaper-sheet">${cells}</div>`;
        }).join('');

        const htmlContent = `<!doctype html><html><head><title>Payslips · ${escapeHtml(period)}</title><meta charset="utf-8"><style>@page{size:portrait;margin:4mm 6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:8px;line-height:1.25}.bondpaper-sheet{width:100%;max-width:210mm;min-height:260mm;max-height:275mm;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}.bondpaper-sheet:last-child{page-break-after:auto;break-after:auto}.slip-cell{box-sizing:border-box;padding:3mm 4mm;display:flex;flex-direction:column;justify-content:flex-start;border-right:1px dashed #777;border-bottom:1px dashed #777;overflow:hidden}.slip-cell:nth-child(2n){border-right:none}.slip-cell:nth-child(n+3){border-bottom:none}.slip{width:100%;max-width:86mm;margin:0 auto}header{text-align:center;border-bottom:1px dashed #000;padding-bottom:1.5mm;margin-bottom:1.5mm}h2{font-size:13px;margin:0 0 0.8mm;letter-spacing:1px}.name{font-size:10.5px;font-weight:bold;margin-bottom:0.5mm}.emp-meta{font-size:7.5px;color:#222}.period{font-weight:bold;font-size:8px;margin-top:1mm}section{margin:0 0 1.5mm}h3{font-size:8px;margin:0 0 0.8mm;padding-bottom:0.5mm;border-bottom:1px solid #000;letter-spacing:0.5px}.line{display:flex;justify-content:space-between;gap:1.5mm;padding:0.4mm 0;font-size:7.5px}.line span{max-width:50mm;overflow-wrap:anywhere}.line b{text-align:right;white-space:nowrap;font-weight:normal}.net{border-top:1.2px solid #000;border-bottom:1.2px solid #000;padding:1mm 0;margin:1.5mm 0;display:flex;justify-content:space-between;align-items:center;font-weight:bold}.net span{font-size:8.5px}.net strong{font-size:13px;white-space:nowrap}footer{font-size:6.8px;line-height:1.35;overflow-wrap:anywhere;border-top:1px dashed #000;padding-top:1mm;text-align:center}@media print and (max-width:90mm){.bondpaper-sheet{display:block;min-height:auto;max-height:none}.slip-cell{border-right:none!important;border-bottom:1px dashed #000!important;padding:3mm 0}}@media screen{body{background:#f1f5f9;padding:16px}.bondpaper-sheet{background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.12);margin:16px auto;padding:4mm 6mm}}</style></head><body>${sheetsHtml}<script>window.onload=()=>{window.focus();window.print()}</script></body></html>`;

        const printWindow = window.open('', '_blank', 'width=850,height=900');
        if (!printWindow) {
            // Invisible iframe fallback in case popups are blocked in iframe
            const frame = document.createElement('iframe');
            frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
            document.body.appendChild(frame);
            const doc = frame.contentDocument || frame.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(htmlContent);
                doc.close();
                setTimeout(() => {
                    frame.contentWindow?.focus();
                    frame.contentWindow?.print();
                    setTimeout(() => frame.remove(), 2000);
                }, 400);
                return;
            }
            toast.error('Please allow pop-ups to print payslips.');
            return;
        }
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    }, [period, releasedRows, emps.list, sf.members, sf.calcs]);
    const qc = useQueryClient();
    const release = useMutation({
        mutationFn: (ids) => releasePayslips({ ids }),
        onSuccess: async (r) => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['records', 'payslips'] }),
                qc.invalidateQueries({ queryKey: ['records', 'cashAdvances'] }),
                qc.invalidateQueries({ queryKey: ['sf'] }),
                qc.invalidateQueries({ queryKey: ['sfAudit'] }),
                qc.invalidateQueries({ queryKey: ['dashboard'] }),
            ]);
            toast.success(`Released ${r.released} payslip${r.released === 1 ? '' : 's'} · balances updated`);
        },
        onError: (e) => toast.error(e.message),
    });
    const { isAdmin } = useRole();
    const releaseAll = useCallback(() => release.mutate(drafts.map((p) => p.id)), [drafts, release]);
    const selectionActions = useCallback((selected, clear) => {
        if (!isAdmin)
            return null;
        const selectedDrafts = selected.filter((p) => p.status !== 'Released');
        return (<div className="flex flex-wrap items-center gap-2">
        {selectedDrafts.length > 0 && <Button size="sm" variant="outline" className="h-8" disabled={release.isPending} onClick={() => release.mutate(selectedDrafts.map((p) => p.id), { onSuccess: () => clear() })}>
          <ListChecks className="mr-1.5 h-3.5 w-3.5"/>Release selected ({selectedDrafts.length})
        </Button>}
        <Button size="sm" variant="destructive" className="h-8" disabled={del.isPending} onClick={() => { setBulkDeleting(selected); setClearBulkSelection(() => clear); }}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5"/>Delete selected ({selected.length})
        </Button>
      </div>);
    }, [isAdmin, release, del]);
    const columns = useMemo(() => [
        { id: 'emp', header: 'Employee', accessorFn: (r) => emps.map[firstId(r.employee) ?? ''] ?? '—', cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> },
        { accessorKey: 'daysWorked', header: 'Worked', cell: ({ getValue }) => <span className="num">{Number(getValue() ?? 0)}d</span> },
        { accessorKey: 'daysAbsent', header: 'Absent', cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue() != null ? `${Number(getValue())}d` : '0d'}</span> },
        money('grossPay', 'Gross'), money('otherBenefits', 'Other Benefits'), money('sss', 'SSS'), money('philHealth', 'PhilHealth'), money('pagIbig', 'Pag-IBIG'), money('withholdingTax', 'Tax'), money('cashAdvanceDeduction', 'Cash Adv.'), money('sinkingContributionDeduction', 'Contributions'), money('loanDeductions', 'Loans'),
        { accessorKey: 'netPay', header: 'Net Pay', cell: ({ getValue }) => <span className="num font-bold text-primary">{peso(getValue())}</span> },
        { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
        { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => (<div className="flex justify-end gap-1">
        {isAdmin && row.original.status !== 'Released' && (<Button size="icon" variant="ghost" className="h-8 w-8" title="Release" disabled={release.isPending} onClick={() => release.mutate([row.original.id])}><Send className="h-4 w-4"/></Button>)}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewing(row.original)}><Eye className="h-4 w-4"/></Button>
        {isAdmin && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="h-4 w-4"/></Button>}
      </div>) },
    ], [emps.map, release, isAdmin]);
    const stats = [['Gross payroll', totals.gross], ['Gov. contributions', totals.gov], ['Withholding tax', totals.tax], ['Net payroll', totals.net]];
    return (<div>
      <PageHeader title="Payroll" description="Semi-monthly payslips with SSS, PhilHealth, Pag-IBIG and BIR (TRAIN) deductions." actions={<>
          {isAdmin && period !== 'all' && releasedRows.length > 0 && <Button variant="outline" onClick={printReleasedCoverage}><Printer className="mr-2 h-4 w-4"/>Bulk print ({releasedRows.length})</Button>}
          {isAdmin && drafts.length > 0 && <Button variant="outline" disabled={release.isPending} onClick={releaseAll}><Send className="mr-2 h-4 w-4"/>Release {drafts.length} draft{drafts.length === 1 ? '' : 's'}</Button>}
          {isAdmin && <Button onClick={() => setGenOpen(true)}><Play className="mr-2 h-4 w-4"/>Run payroll</Button>}
        </>}/>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([l, v], i) => (<div key={l} className={`rounded-xl border p-4 shadow-sm ${i === 3 ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${i === 3 ? 'opacity-80' : 'text-muted-foreground'}`}>{l}</div>
            <div className="num mt-1 truncate text-xl font-bold">{peso(v)}</div>
          </div>))}
      </div>
      <DataTable columns={columns} data={rows} loading={isLoading} searchPlaceholder="Search payslips…" selectionActions={selectionActions} toolbar={<Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All periods</SelectItem>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>}/>
      <PayslipDialog slip={viewing} employee={emps.list.find((e) => e.id === firstId(viewing?.employee))} onClose={() => setViewing(null)}/>
      <GeneratePayrollDialog open={genOpen} onOpenChange={setGenOpen}/>
      <AlertDialog open={!!bulkDeleting} onOpenChange={(o) => !o && setBulkDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {bulkDeleting?.length ?? 0} selected payslip(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. If any selected payslips have been released, their cash advance and loan balances will be restored according to the existing delete behavior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={del.isPending} onClick={async () => {
            if (!bulkDeleting)
                return;
            try {
                // Delete sequentially: released payslips may restore the same advance balance,
                // and parallel requests could overwrite one another's balance updates.
                for (const payslip of bulkDeleting) {
                    await del.mutateAsync(payslip.id);
                }
                toast.success(`Deleted ${bulkDeleting.length} selected payslip(s)`);
                clearBulkSelection?.();
                setBulkDeleting(null);
                setClearBulkSelection(null);
            }
            catch (e) {
                toast.error(e.message || 'Could not delete selected payslips');
            }
        }}>Delete selected</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this payslip?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.status === 'Released'
            ? 'Cash advance and loan balances deducted by this payslip will be restored.'
            : 'This is a draft — cash advance and loan balances were not touched.'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && del.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
