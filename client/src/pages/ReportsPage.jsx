import { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer, Sparkles, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
import { Badge } from '@/shared/ui/badge';
import PageHeader from '../components/PageHeader';
import BirTaxReportSection from '../components/BirTaxReportSection';
import { useNameMap, useRecords } from '../services/records';
import { useSf } from '../services/sf';
import { firstId, fmtDate, peso } from '../utils/format';
import { toast } from 'sonner';

const safe = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
const csvCell = (v) => {
    const s = safe(v);
    // Prevent spreadsheet formula injection in exported text.
    return '"' + (/^[=+@\-]/.test(s) ? "'" + s : s) + '"';
};
const dateInRange = (v, from, to) => {
    const d = String(v ?? '').slice(0, 10);
    return !d || (!from || d >= from) && (!to || d <= to);
};
const downloadCsv = (filename, headers, rows) => {
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

export default function ReportsPage() {
    const [mainTab, setMainTab] = useState('bir_tax');
    const [type, setType] = useState('payroll');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [person, setPerson] = useState('all');

    const { data: attendance = [], isLoading: attendanceLoading } = useRecords('attendance');
    const { data: payslips = [], isLoading: payrollLoading } = useRecords('payslips');
    const employees = useNameMap('employees');
    const sf = useSf();

    const rows = useMemo(() => {
        if (type === 'attendance')
            return attendance.filter((r) => dateInRange(r.workDate, from, to) && (person === 'all' || firstId(r.employee) === person))
                .sort((a, b) => String(a.workDate ?? '').localeCompare(String(b.workDate ?? '')))
                .map((r) => [fmtDate(r.workDate), employees.map[firstId(r.employee) ?? ''] ?? '—', r.timeIn || '—', r.timeOut || '—', r.status || '—', r.dayType || '—', Number(r.lateMinutes || 0), Number(r.overtimeHours || 0), Number(r.nightDiffHours || 0), peso(r.otherBenefit)]);
        if (type === 'payroll')
            return payslips.filter((p) => (!from || String(p.periodEnd ?? p.periodStart ?? '') >= from) &&
                (!to || String(p.periodStart ?? p.periodEnd ?? '') <= to) &&
                (person === 'all' || firstId(p.employee) === person))
                .sort((a, b) => String(a.periodStart ?? '').localeCompare(String(b.periodStart ?? '')))
                .map((p) => [employees.map[firstId(p.employee) ?? ''] ?? '—', p.periodLabel || '—', fmtDate(p.periodStart), fmtDate(p.periodEnd), p.status || '—', Number(p.daysWorked || 0), peso(p.grossPay), peso(p.sss), peso(p.philHealth), peso(p.pagIbig), peso(p.withholdingTax), peso(p.cashAdvanceDeduction), peso(p.sinkingContributionDeduction), peso(p.loanDeductions), peso(p.netPay)]);
        return sf.contributions.filter((c) => dateInRange(c.contributedOn, from, to) && (person === 'all' || c.memberId === person))
            .sort((a, b) => String(a.contributedOn ?? '').localeCompare(String(b.contributedOn ?? '')))
            .map((c) => [fmtDate(c.contributedOn), sf.memberName[c.memberId] ?? '—', c.payrollPeriodStart ? fmtDate(c.payrollPeriodStart) + ' – ' + fmtDate(c.payrollPeriodEnd) : '—', c.referenceNo || '—', c.notes || '', peso(c.amount)]);
    }, [type, attendance, payslips, sf.contributions, sf.memberName, employees.map, from, to, person]);

    const headers = type === 'attendance'
        ? ['Date', 'Employee', 'Time In', 'Time Out', 'Status', 'Day Type', 'Late Minutes', 'Overtime Hours', 'Night Diff Hours', 'Other Benefit']
        : type === 'payroll'
            ? ['Employee', 'Period', 'Period Start', 'Period End', 'Status', 'Days Worked', 'Gross Pay', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax', 'Cash Advance Deduction', 'Contribution Deduction', 'Loan Deductions', 'Net Pay']
            : ['Contribution Date', 'Member', 'Payroll Coverage', 'Reference No.', 'Notes', 'Amount'];

    const loading = type === 'attendance' ? attendanceLoading : type === 'payroll' ? payrollLoading : sf.isLoading;
    const people = type === 'contributions' ? sf.members.map((m) => ({ id: m.id, name: m.fullName })) : employees.list.map((e) => ({ id: e.id, name: e.fullName }));

    const total = useMemo(() => {
        const index = type === 'attendance' ? -1 : type === 'payroll' ? 14 : 5;
        if (index < 0)
            return null;
        return rows.reduce((sum, row) => sum + (Number(String(row[index] ?? '').replace(/[^0-9.-]/g, '')) || 0), 0);
    }, [rows, type]);

    const title = type === 'attendance' ? 'Attendance Report' : type === 'payroll' ? 'Payroll Report' : 'Contributions Report';

    const exportCsv = () => {
        if (loading) {
            toast.error('Please wait for the report data to finish loading.');
            return;
        }
        downloadCsv('sahod-' + type + '-' + (from || 'all') + '-to-' + (to || 'all') + '.csv', headers, rows);
        toast.success('CSV export downloaded. You can open it in Excel.');
    };

    const printReport = () => {
        if (loading) {
            toast.error('Please wait for the report data to finish loading.');
            return;
        }
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
        const tableHead = headers.map(h => '<th>' + esc(h) + '</th>').join('');
        const tableRows = rows.map(row => '<tr>' + row.map(cell => '<td>' + esc(cell) + '</td>').join('') + '</tr>').join('');
        const win = window.open('', '_blank');
        if (!win) {
            toast.error('Please allow pop-ups to print or save as PDF.');
            return;
        }
        win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>@page{size:landscape;margin:12mm}body{font:11px Arial,sans-serif;color:#111}h1{font-size:20px;margin:0 0 6px}.meta{margin-bottom:16px;color:#444}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}th{background:#eee}tr{break-inside:avoid}footer{margin-top:16px;display:flex;justify-content:space-between} .sign{margin-top:28px;width:220px;border-top:1px solid #555;padding-top:5px}@media print{button{display:none}}</style></head><body><h1>' + esc(title) + '</h1><div class="meta">Coverage: ' + esc(from || 'All dates') + ' to ' + esc(to || 'All dates') + ' · Generated: ' + esc(new Date().toLocaleString()) + ' · Records: ' + rows.length + '</div><table><thead><tr>' + tableHead + '</tr></thead><tbody>' + tableRows + '</tbody></table><footer><div class="sign">Prepared by</div><div class="sign">Checked / Approved by</div></footer><script>window.onload=()=>{window.focus();window.print()}</script></body></html>');
        win.document.close();
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Reports & BIR Tax Compliance"
                description="Generate comprehensive BIR tax returns (1601-C, 1601-EQ, 1604-C/2316) with AI assistance, track statutory filing deadlines, and export attendance, payroll, or contribution ledgers."
            />

            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
                <TabsList className="grid w-full sm:w-auto sm:inline-flex grid-cols-2 h-11 p-1 bg-muted/60 border">
                    <TabsTrigger value="bir_tax" className="gap-2 text-xs sm:text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI BIR Tax & Payroll Specialist
                        <Badge variant="secondary" className="hidden md:inline-flex text-[10px] bg-primary/10 text-primary border-primary/20">
                            TRAIN Law Ready
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="standard" className="gap-2 text-xs sm:text-sm font-medium">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        Standard Export Reports
                    </TabsTrigger>
                </TabsList>

                {/* AI BIR Tax Specialist Tab */}
                <TabsContent value="bir_tax" className="mt-5 space-y-6">
                    <BirTaxReportSection payslips={payslips} employees={employees.map} />
                </TabsContent>

                {/* Standard Reports Tab */}
                <TabsContent value="standard" className="mt-5 space-y-5">
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-1.5">
                                <Label>Report type</Label>
                                <Select value={type} onValueChange={(v) => { setType(v); setPerson('all'); }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="payroll">Payroll Ledger</SelectItem>
                                        <SelectItem value="attendance">Attendance & DTR</SelectItem>
                                        <SelectItem value="contributions">Sinking Fund Contributions</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>From date</Label>
                                <Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>To date</Label>
                                <Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{type === 'contributions' ? 'Member' : 'Employee'}</Label>
                                <Select value={person} onValueChange={setPerson}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All {type === 'contributions' ? 'members' : 'employees'}</SelectItem>
                                        {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || 'Unnamed'}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button variant="outline" onClick={exportCsv} disabled={loading}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Export Excel / CSV
                            </Button>
                            <Button onClick={printReport} disabled={loading}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print / Save PDF
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-lg font-semibold">{title}</h2>
                            <p className="text-sm text-muted-foreground">Coverage: {from || 'All dates'} – {to || 'All dates'}</p>
                        </div>
                        <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-xs">
                            Records: <b>{loading ? 'Loading…' : rows.length}</b>
                            {type === 'payroll' && total !== null && <span className="ml-3">Net payroll: <b>{peso(total)}</b></span>}
                            {type === 'contributions' && total !== null && <span className="ml-3">Total: <b>{peso(total)}</b></span>}
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                                <tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={headers.length} className="p-8 text-center text-muted-foreground">Loading report data…</td></tr>
                                ) : rows.length ? (
                                    rows.map((row, i) => (
                                        <tr key={i} className="border-t hover:bg-muted/30">
                                            {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{cell}</td>)}
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={headers.length} className="p-8 text-center text-muted-foreground">No records match these filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        PDF: choose “Save as PDF” in your browser’s print dialog. CSV files open directly in Excel.
                    </p>
                </TabsContent>
            </Tabs>
        </div>
    );
}
