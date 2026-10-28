import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Landmark } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import PageHeader from '../components/PageHeader';
import { useSf } from '../services/sf';
import { useNameMap } from '../services/records';
import { firstId, peso, fmtDate } from '../utils/format';
const normalize = (v) => String(v ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
export default function PayrollLoansPage() {
    const sf = useSf();
    const employees = useNameMap('employees');
    const rows = useMemo(() => sf.calcs.map((c) => {
        const employee = employees.list.find((e) => {
            if (c.loan.employeeId && firstId(c.loan.employeeId) === e.id) return true;
            if (normalize(e.fullName) === normalize(c.loan.borrowerName)) return true;
            const mem = sf.members.find((m) => (m.employeeId && firstId(m.employeeId) === e.id) || normalize(m.fullName) === normalize(e.fullName));
            return mem && normalize(mem.fullName) === normalize(c.loan.borrowerName);
        });
        return { c, employee };
    }).sort((a, b) => String(a.c.loan.borrowerName).localeCompare(String(b.c.loan.borrowerName))), [sf.calcs, sf.members, employees.list]);
    return <div>
    <PageHeader title="Loans" description="Read-only view of Sinking Fund loans. Create and manage all loans in the Sinking Fund section." actions={<Link to="/sinking-fund/loans" className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">Open Sinking Fund <ArrowUpRight className="ml-2 h-4 w-4"/></Link>}/>
    <div className="mb-4 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
      This list is synced from Sinking Fund. Loan records cannot be created or edited here. Payslip deductions are recorded as payments against the Sinking Fund loan when the payslip is released.
    </div>
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      {sf.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10"/>)}</div> :
            <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Borrower / Employee</th><th>Loan details</th><th className="text-right">Principal</th><th className="text-right">Outstanding balance</th><th>Next due</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map(({ c, employee }) => <tr key={c.loan.id} className="border-t hover:bg-muted/30">
            <td className="p-3"><div className="font-semibold">{c.loan.borrowerName}</div><div className="text-xs text-muted-foreground">{employee?.fullName ?? 'No matching employee record'}</div></td>
            <td className="text-xs text-muted-foreground">{c.loan.loanType} · {c.loan.frequency} · {c.loan.monthlyRate}%/mo · {c.loan.termMonths} months</td>
            <td className="num text-right">{peso(c.basePrincipal)}</td><td className="num text-right font-semibold">{peso(c.balance)}</td>
            <td>{c.nextDue ? fmtDate(c.nextDue) : '—'}</td>
            <td><Badge variant={!employee ? 'destructive' : c.overdue ? 'destructive' : c.status === 'Fully Paid' ? 'default' : 'secondary'}>{!employee ? 'Match employee' : c.overdue ? 'Overdue' : c.status}</Badge></td>
            <td className="pr-3 text-right"><Link to={`/sinking-fund/loans/${c.loan.id}`} className="inline-flex items-center text-primary hover:underline"><Landmark className="mr-1 h-3.5 w-3.5"/>Details</Link></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No Sinking Fund loans found. Add loans under Sinking Fund → Loans.</td></tr>}</tbody>
        </table>}
    </div>
  </div>;
}
