import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import PageHeader from '../../components/PageHeader';
import { useSf } from '../../services/sf';
import { useRole } from '../../services/role';
import { reconcileHistoricalInterest } from '../../lib/interestReconciliation';
import { peso, fmtDate } from '../../utils/format';
export default function SfInterestReconciliationPage() {
    const { isAdmin, isLoading: roleLoading } = useRole();
    const sf = useSf();
    const [q, setQ] = useState('');

    if (!roleLoading && !isAdmin) {
        return <Navigate to="/sinking-fund" replace />;
    }
    const rows = useMemo(() => sf.loans.flatMap((loan) => {
        const current = sf.calcs.find((c) => String(c.loan.id) === String(loan.id));
        return reconcileHistoricalInterest(loan, sf.payments, sf.declarations).map((segment) => ({
            loan, segment, currentStatus: current?.status ?? 'Unknown',
        }));
    }).filter((row) => {
        if (q && !String(row.loan.borrowerName ?? '').toLowerCase().includes(q.toLowerCase()))
            return false;
        return row.segment.paymentsRecorded > 0 || row.segment.historicalInterestPaid > 0;
    }).sort((a, b) => b.segment.declaredAt.localeCompare(a.segment.declaredAt)), [sf.loans, sf.payments, sf.declarations, sf.calcs, q]);
    const totalHistoricalInterest = rows.reduce((sum, row) => sum + row.segment.historicalInterestPaid, 0);
    const totalPayments = rows.reduce((sum, row) => sum + row.segment.paymentsRecorded, 0);
    if (sf.isLoading)
        return <div className="space-y-3"><Skeleton className="h-20 rounded-xl"/><Skeleton className="h-64 rounded-xl"/></div>;
    return (<div>
      <PageHeader title="Unreported Interest Reconciliation" description="Review interest reconstructed from payments made before balance declarations and check what the current loan report may have omitted."/>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Historical interest found</div><div className="num mt-1 text-2xl font-bold">{peso(totalHistoricalInterest)}</div><div className="text-xs text-muted-foreground">Across listed declaration periods</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Payments in those periods</div><div className="num mt-1 text-2xl font-bold">{peso(totalPayments)}</div><div className="text-xs text-muted-foreground">Recorded payment amounts, excluding late fees</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Periods to review</div><div className="num mt-1 text-2xl font-bold">{rows.length}</div><div className="text-xs text-muted-foreground">One row per declaration period with payments</div></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="h-9 w-64 pl-8" placeholder="Search borrower (e.g. Kaja, Razel)" value={q} onChange={(e) => setQ(e.target.value)}/></div>
        <Button variant="outline" onClick={() => window.print()}>Print reconciliation</Button>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/>
        <div><b>Review before making accounting adjustments.</b> Historical interest is reconstructed from the loan's rate, declaration history, and recorded payment amounts; the payment ledger does not separately store a manually confirmed interest amount. This report is read-only and does not create, delete, or change payments or declarations.</div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Borrower</th><th>Declaration date</th><th className="text-right">Previous baseline</th><th className="text-right">New baseline</th><th className="text-right">Payments before declaration</th><th className="text-right">Reconstructed interest</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map(({ loan, segment, currentStatus }) => (<tr key={segment.declarationId} className="border-t">
                <td className="p-3"><Link to={`/sinking-fund/loans/${loan.id}`} className="font-medium text-primary hover:underline">{loan.borrowerName}</Link><div className="text-xs text-muted-foreground">{loan.loanType ?? 'Loan'} · {loan.loanGroup ?? 'No group'}</div></td>
                <td>{fmtDate(segment.declaredAt)}</td>
                <td className="num text-right">{peso(segment.previousPrincipal)}</td>
                <td className="num text-right">{peso(segment.declaredPrincipal)}</td>
                <td className="num text-right">{peso(segment.paymentsRecorded)}</td>
                <td className="num text-right font-semibold text-primary">{peso(segment.historicalInterestPaid)}</td>
                <td>{currentStatus === 'Fully Paid' ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Fully Paid</Badge> : <Badge variant="secondary">{currentStatus}</Badge>}</td>
              </tr>))}
            {!rows.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No declaration periods with recorded payments match this search.</td></tr>}
          </tbody>
          {rows.length > 0 && <tfoot><tr className="border-t bg-muted/30 font-bold"><td className="p-3" colSpan={4}>Total for visible rows</td><td className="num text-right">{peso(totalPayments)}</td><td className="num text-right">{peso(totalHistoricalInterest)}</td><td /></tr></tfoot>}
        </table>
      </div>
    </div>);
}
