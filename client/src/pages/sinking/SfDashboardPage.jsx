import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, HandCoins, LineChart, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import PageHeader from '../../components/PageHeader';
import { useSf } from '../../services/sf';
import { peso, fmtDate } from '../../utils/format';
import { phToday } from '../../lib/loanCalc';
import { historicalInterestTotal } from '../../lib/interestReconciliation';
function Kpi({ icon: Icon, label, value, sub, onClick }) {
    return (<button type="button" onClick={onClick} disabled={!onClick} className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition enabled:hover:border-primary enabled:hover:shadow-md disabled:cursor-default">
      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5"/></div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="num mt-0.5 truncate text-xl font-bold">{value}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
    </button>);
}
export default function SfDashboardPage() {
    const sf = useSf();
    const [ledgerOpen, setLedgerOpen] = useState(false);
    const c = sf.calcs;
    const sum = (f) => c.reduce((a, x) => a + f(x), 0);
    const paid = c.filter((x) => x.status === 'Fully Paid');
    const totalInterestPaid = (x) => x.interestPaid + historicalInterestTotal(x.loan, sf.payments, sf.declarations);
    const disbursed = sf.loans.reduce((a, l) => a + Number(l.principal || 0), 0);
    const realized = c.reduce((a, x) => a + (x.status === 'Fully Paid' ? totalInterestPaid(x) : 0), 0);
    const interestCollected = c.reduce((a, x) => a + totalInterestPaid(x), 0);
    const accrued = sum((x) => (x.status !== 'Fully Paid' ? x.accruedInterest : 0));
    const collections = sum((x) => x.totalCollected);
    const principalCollected = sum((x) => x.principalPaid);
    const outstanding = sum((x) => x.balance);
    const outstandingPrincipal = sum((x) => x.principalBalance);
    const capital = sf.contributions.reduce((a, x) => a + Number(x.amount || 0), 0);
    const feesPaid = sum((x) => x.lateFeesPaid);
    const feesPending = sum((x) => x.pendingLateFee);
    const totalDue = sum((x) => x.basePrincipal + x.interestCharged);
    const cashOnHand = capital - disbursed + collections;
    const declaredAdj = disbursed - sum((x) => x.basePrincipal);
    const overdue = c.filter((x) => x.overdue).sort((a, b) => b.daysOverdue - a.daysOverdue);
    const activity = [
        ...sf.payments.map((p) => ({ date: p.paidOn, at: p.createdAt, label: `Payment — ${sf.loans.find((l) => l.id === p.loanId)?.borrowerName ?? 'Loan'}`, amount: Number(p.amount) + Number(p.lateFee || 0), inflow: true })),
        ...sf.contributions.map((x) => ({ date: x.contributedOn, at: x.createdAt, label: `Contribution — ${sf.memberName[x.memberId] ?? 'Member'}`, amount: Number(x.amount), inflow: true })),
        ...sf.loans.map((l) => ({ date: l.startDate, at: l.createdAt, label: `Loan released — ${l.borrowerName}`, amount: Number(l.principal), inflow: false })),
    ].sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at)).slice(0, 10);
    if (sf.isLoading)
        return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl"/>)}</div>;
    return (<div>
      <PageHeader title="Sinking Fund" description={`Portfolio overview as of ${fmtDate(phToday())} (Philippine time)`}/>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} label="Capital disbursed" value={peso(disbursed)} sub={`${sf.loans.length} loans`}/>
        <Kpi icon={Receipt} label="Interest paid (fully paid)" value={peso(realized)} sub={`${paid.length} settled · tap for ledger`} onClick={() => setLedgerOpen(true)}/>
        <Kpi icon={TrendingUp} label="Active accrued interest" value={peso(accrued)} sub="Uncollected, to date"/>
        <Kpi icon={HandCoins} label="Collections received" value={peso(collections)} sub={`${totalDue ? ((collections / totalDue) * 100).toFixed(1) : '0.0'}% recovery`}/>
        <Kpi icon={Wallet} label="Outstanding balance" value={peso(outstanding)} sub="Principal + accrued interest"/>
        <Kpi icon={PiggyBank} label="Member capital fund" value={peso(capital)} sub={`${sf.members.filter((m) => m.status === 'Active').length} active members`}/>
        <Kpi icon={LineChart} label="Total portfolio yield" value={peso(interestCollected + accrued)} sub="Realized + accrued"/>
        <Kpi icon={AlertTriangle} label="Penalties & late fees" value={peso(feesPaid)} sub={`${peso(feesPending)} pending`}/>
      </div>

      <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Portfolio capital & yield equation</h2>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-muted/50 p-3 num">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Cash position</div>
            Member capital {peso(capital)} − Disbursed {peso(disbursed)} + Collections {peso(collections)}
            <div className="mt-1 text-base font-bold">= Cash on hand {peso(cashOnHand)}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 num">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Principal reconciliation</div>
            Principal collected {peso(principalCollected)} + Outstanding principal {peso(outstandingPrincipal)}{Math.abs(declaredAdj) > 0.009 && <> + Declaration adj. {peso(declaredAdj)}</>}
            <div className="mt-1 flex items-center gap-2 text-base font-bold">= {peso(principalCollected + outstandingPrincipal + declaredAdj)}
              {Math.abs(principalCollected + outstandingPrincipal + declaredAdj - disbursed) < 0.05 ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Balanced</Badge> : <Badge variant="destructive">Check</Badge>}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b p-4 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive"/>Overdue accounts & late penalties</div>
          {overdue.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No overdue accounts. 🎉</p> : overdue.map((x) => (<Link key={x.loan.id} to={`/sinking-fund/loans/${x.loan.id}`} className="flex items-center justify-between gap-3 border-b p-4 last:border-0 hover:bg-muted/40">
              <div className="min-w-0"><div className="truncate font-medium">{x.loan.borrowerName}</div>
                <div className="text-xs text-muted-foreground">Due {fmtDate(x.nextDue)} · {x.daysOverdue} days overdue · {peso(x.overdueAmount)} past due</div></div>
              <div className="text-right num"><div className="font-semibold text-destructive">{peso(x.pendingLateFee)}</div><div className="text-[11px] text-muted-foreground">{x.loan.penaltyRate}% fee</div></div>
            </Link>))}
        </div>
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4 font-semibold">Recent activity</div>
          {activity.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No activity yet.</p> : activity.map((a, i) => (<div key={i} className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-0">
              <div className="min-w-0"><div className="truncate">{a.label}</div><div className="text-xs text-muted-foreground">{fmtDate(a.date)}</div></div>
              <div className={`num font-semibold ${a.inflow ? 'text-primary' : 'text-muted-foreground'}`}>{a.inflow ? '+' : '−'}{peso(a.amount)}</div>
            </div>))}
        </div>
      </div>

      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Realized interest — fully paid accounts</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto text-sm">
            <table className="w-full"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Borrower</th><th>Principal</th><th>Interest</th><th>Fees</th></tr></thead>
              <tbody>{paid.map((x) => <tr key={x.loan.id} className="border-t num"><td className="py-2 font-sans">{x.loan.borrowerName}</td><td>{peso(x.basePrincipal)}</td><td className="font-semibold text-primary">{peso(totalInterestPaid(x))}{historicalInterestTotal(x.loan, sf.payments, sf.declarations) > 0 && <div className="text-[10px] font-normal text-muted-foreground">includes pre-declaration interest</div>}</td><td>{peso(x.lateFeesPaid)}</td></tr>)}
                {paid.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No fully paid loans yet.</td></tr>}</tbody>
              <tfoot><tr className="border-t font-bold num"><td className="py-2 font-sans">Total</td><td /><td>{peso(realized)}</td><td /></tr></tfoot></table>
          </div>
        </DialogContent>
      </Dialog>
    </div>);
}
