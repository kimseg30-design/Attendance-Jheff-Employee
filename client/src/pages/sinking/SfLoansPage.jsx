import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Download, Plus, Printer, Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import PageHeader from '../../components/PageHeader';
import { useSf } from '../../services/sf';
import { useRole } from '../../services/role';
import { peso, fmtDate } from '../../utils/format';
const STATUS = ['All', 'Unpaid', 'Partial', 'Fully Paid', 'Unsettled Overdue'];
export function LoanStatus({ c }) {
    if (c.overdue)
        return <Badge variant="destructive">Overdue {c.daysOverdue}d</Badge>;
    if (c.status === 'Fully Paid')
        return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Fully Paid</Badge>;
    return <Badge variant="secondary">{c.status}</Badge>;
}
function F({ value, onChange, options }) {
    return <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
    <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>;
}
export default function SfLoansPage() {
    const { calcs, isLoading } = useSf();
    const { isAdmin } = useRole();
    const [view, setView] = useState('merged');
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('All');
    const [freq, setFreq] = useState('All');
    const [group, setGroup] = useState('All');
    const [type, setType] = useState('All');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [open, setOpen] = useState({});
    const rows = useMemo(() => calcs.filter((c) => {
        const l = c.loan;
        if (q && !String(l.borrowerName).toLowerCase().includes(q.toLowerCase()))
            return false;
        if (status === 'Unsettled Overdue' ? !c.overdue : status !== 'All' && c.status !== status)
            return false;
        if (freq !== 'All' && l.frequency !== freq)
            return false;
        if (group !== 'All' && l.loanGroup !== group)
            return false;
        if (type !== 'All' && l.loanType !== (type === 'New' ? 'New Loan' : 'Reloan'))
            return false;
        if (from && l.startDate < from)
            return false;
        if (to && l.startDate > to)
            return false;
        return true;
    }).sort((a, b) => b.loan.startDate.localeCompare(a.loan.startDate)), [calcs, q, status, freq, group, type, from, to]);
    const groups = useMemo(() => {
        const m = new Map();
        rows.forEach((c) => { const k = String(c.loan.borrowerName).trim(); m.set(k, [...(m.get(k) ?? []), c]); });
        return [...m.entries()].map(([name, list]) => ({
            name, list, principal: list.reduce((a, c) => a + c.basePrincipal, 0), paid: list.reduce((a, c) => a + c.totalCollected, 0),
            balance: list.reduce((a, c) => a + c.balance, 0), overdue: list.some((c) => c.overdue), settled: list.every((c) => c.status === 'Fully Paid'),
        }));
    }, [rows]);
    const exportCsv = () => {
        const headers = ['Borrower', 'Group', 'Type', 'Released', 'Frequency', 'Rate %/mo', 'Term (mo)', 'Principal', 'Interest charged', 'Interest paid', 'Principal paid', 'Late fees paid', 'Collected', 'Balance', 'Status', 'Next due'];
        const values = rows.map((c) => [
            c.loan.borrowerName, c.loan.loanGroup, c.loan.loanType, c.loan.startDate, c.loan.frequency,
            c.loan.monthlyRate, c.loan.termMonths, c.basePrincipal, c.interestCharged,
            c.interestPaid, c.principalPaid, c.lateFeesPaid, c.totalCollected, c.balance,
            c.overdue ? `Overdue (${c.daysOverdue}d)` : c.status, c.nextDue ?? '',
        ]);
        // Quote every cell and neutralize spreadsheet formula prefixes to prevent CSV injection.
        const cell = (value) => {
            let text = String(value ?? '');
            if (/^[\\s\\u0000-\\u001f]*[=+@-]/.test(text))
                text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const csv = [headers, ...values].map((row) => row.map(cell).join(',')).join('\\r\\n');
        const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sinking-fund-loans-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };
    return (<div>
      <PageHeader title="Loans" description="All loan contracts, grouped by borrower or itemized. Filter, export and print audit sheets." actions={<>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Print</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-2 h-4 w-4"/>Export CSV</Button>
          {isAdmin && <Button asChild><Link to="/sinking-fund/add-loan"><Plus className="mr-2 h-4 w-4"/>Add loan</Link></Button>}
        </>}/>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="merged">By borrower</TabsTrigger><TabsTrigger value="itemized">Itemized</TabsTrigger></TabsList></Tabs>
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="h-9 w-48 pl-8" placeholder="Search borrower…" value={q} onChange={(e) => setQ(e.target.value)}/></div>
        <F value={status} onChange={setStatus} options={STATUS}/>
        <F value={freq} onChange={setFreq} options={['All', 'Weekly', 'Biweekly', 'Monthly']}/>
        <F value={group} onChange={setGroup} options={['All', '1st Group', '2nd Group']}/>
        <F value={type} onChange={setType} options={['All', 'New', 'Reloan']}/>
        <Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} title="Released from"/>
        <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} title="Released to"/>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10"/>)}</div> : (<table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Borrower</th><th>Details</th><th className="text-right">Principal</th><th className="text-right">Collected</th><th className="text-right">Balance</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {view === 'itemized' ? rows.map((c) => <LoanRow key={c.loan.id} c={c}/>) : groups.map((g) => (<Fragment key={g.name}>
                  <tr className="cursor-pointer border-t bg-muted/20 font-medium hover:bg-muted/40" onClick={() => setOpen((o) => ({ ...o, [g.name]: !o[g.name] }))}>
                    <td className="p-3"><span className="inline-flex items-center gap-1">{open[g.name] ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}{g.name}</span></td>
                    <td className="text-muted-foreground">{g.list.length} loan{g.list.length > 1 ? 's' : ''}</td>
                    <td className="num text-right">{peso(g.principal)}</td><td className="num text-right">{peso(g.paid)}</td><td className="num text-right font-semibold">{peso(g.balance)}</td>
                    <td className="p-3">{g.overdue ? <Badge variant="destructive">Overdue</Badge> : g.settled ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Settled</Badge> : <Badge variant="secondary">Active</Badge>}</td>
                  </tr>
                  {open[g.name] && g.list.map((c) => <LoanRow key={c.loan.id} c={c} nested/>)}
                </Fragment>))}
              {!rows.length && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No loans match these filters.</td></tr>}
            </tbody>
          </table>)}
      </div>
    </div>);
}
function LoanRow({ c, nested }) {
    const l = c.loan;
    return (<tr className="border-t hover:bg-muted/30">
      <td className={nested ? 'p-3 pl-10' : 'p-3'}><Link to={`/sinking-fund/loans/${l.id}`} className="font-medium text-primary hover:underline">{nested ? fmtDate(l.startDate) : l.borrowerName}</Link></td>
      <td className="text-xs text-muted-foreground">{nested ? '' : `${fmtDate(l.startDate)} · `}{l.loanType} · {l.loanGroup} · {l.monthlyRate}%/mo × {l.termMonths}mo · {l.frequency}</td>
      <td className="num text-right">{peso(c.basePrincipal)}</td><td className="num text-right">{peso(c.totalCollected)}
        {c.totalCollected > 0 && <div className="text-[11px] text-muted-foreground">Int {peso(c.interestPaid)} · Prin {peso(c.principalPaid)}{c.principalPaid <= 0 && c.interestPaid > 0 && <span className="ml-1 font-semibold text-amber-700">· Interest only</span>}</div>}</td>
      <td className="num text-right font-semibold">{peso(c.balance)}</td><td className="p-3"><LoanStatus c={c}/></td>
    </tr>);
}
