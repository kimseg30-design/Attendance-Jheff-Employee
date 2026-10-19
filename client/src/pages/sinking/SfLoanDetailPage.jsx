import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, FileSignature, FileText, MoreHorizontal, Paperclip, Plus, Printer, Scale, Trash2, Zap } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { Skeleton } from '@/shared/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/ui/alert-dialog';
import { useSf, useSfDeclare, useSfDelete, useSfSave } from '../../services/sf';
import { useRole } from '../../services/role';
import { phToday } from '../../lib/loanCalc';
import { peso, fmtDate } from '../../utils/format';
import PaymentDialog, { smsText } from '../../components/sinking/PaymentDialog';
import { printContract, printPromissoryNote, printSOA } from '../../components/sinking/printDocs';
import { LoanStatus } from './SfLoansPage';
function DeclareDialog({ open, onOpenChange, loanId, current }) {
    const declare = useSfDeclare();
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(phToday());
    const [reason, setReason] = useState('');
    const ok = amount !== '' && Number(amount) >= 0 && reason.trim().length > 2 && /^\d{4}-\d{2}-\d{2}$/.test(date);
    return (<Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <DialogHeader><DialogTitle>Declare balance</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Officially reset this loan's baseline principal. Interest restarts from the declaration date, and only payments after it count. Current principal balance: <b className="num">{peso(current)}</b>.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>New principal (₱)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}/></div>
        <div className="space-y-1.5"><Label>As of</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}/></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={!ok || declare.isPending} onClick={() => declare.mutate({ loanId, principal: Number(amount), declaredAt: date, previousPrincipal: current, reason }, { onSuccess: () => onOpenChange(false) })}>Declare</Button></DialogFooter>
    </DialogContent></Dialog>);
}
function CollectionBreakdown({ c }) {
    const n = c.ledger.length;
    const interestOnlyCount = c.ledger.filter((x) => x.interest > 0 && x.principal <= 0).length;
    const onlyInterest = n > 0 && c.principalPaid <= 0 && c.interestPaid > 0;
    const pct = (v) => (c.totalCollected > 0 ? (v / c.totalCollected) * 100 : 0);
    const parts = [['Interest', c.interestPaid, 'bg-amber-500'], ['Principal', c.principalPaid, 'bg-primary'], ['Late fees', c.lateFeesPaid, 'bg-destructive']];
    return (<div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">Collection received · <span className="num">{peso(c.totalCollected)}</span></div>
        {n === 0 ? <span className="text-xs text-muted-foreground">No collections yet</span>
            : onlyInterest ? <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-700">Interest only so far — principal not yet reduced</span>
                : <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Principal being paid down ({peso(c.principalPaid)} of {peso(c.basePrincipal)})</span>}
      </div>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted">{parts.map(([k, v, cl]) => <div key={k} className={cl} style={{ width: `${pct(v)}%` }}/>)}</div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {parts.map(([k, v, cl]) => <div key={k}><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${cl}`}/>{k}</div><div className="num font-semibold">{peso(v)} <span className="text-xs font-normal text-muted-foreground">{pct(v).toFixed(0)}%</span></div></div>)}
        <div><div className="text-xs text-muted-foreground">Interest-only payments</div><div className="num font-semibold">{interestOnlyCount} of {n}</div></div>
      </div>
    </div>);
}
export default function SfLoanDetailPage() {
    const { id } = useParams();
    const nav = useNavigate();
    const sf = useSf();
    const { isAdmin } = useRole();
    const save = useSfSave();
    const del = useSfDelete();
    const [payOpen, setPayOpen] = useState(false);
    const [declOpen, setDeclOpen] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const c = sf.calcs.find((x) => x.loan.id === id);
    if (sf.isLoading)
        return <Skeleton className="h-96 rounded-xl"/>;
    if (!c)
        return <div className="p-10 text-center text-muted-foreground">Loan not found. <Link to="/sinking-fund/loans" className="text-primary underline">Back to loans</Link></div>;
    const l = c.loan;
    const creditor = sf.settings.creditorName || 'Sinking Fund';
    const decls = sf.declarations.filter((d) => d.loanId === l.id);
    const stats = [['Principal', peso(c.basePrincipal)], ['Interest charged', `${peso(c.interestCharged)} (${c.cyclesCharged} mo)`], ['Collected', peso(c.totalCollected)], ['Balance', peso(c.balance)]];
    return (<div>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => nav('/sinking-fund/loans')}><ArrowLeft className="mr-1 h-4 w-4"/>Loans</Button>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{l.borrowerName}</h1><LoanStatus c={c}/></div>
          <p className="mt-1 text-sm text-muted-foreground">{l.loanType} · {l.loanGroup} · {l.monthlyRate}%/mo × {l.termMonths} mo · {l.frequency} · released {fmtDate(l.startDate)} · matures {fmtDate(c.maturity)}{l.earlySettlement && ' · Early settlement (interest locked to month 1)'}</p>
          {c.postMaturityCycles > 0 && (<div className="mt-2 inline-flex flex-wrap items-center gap-x-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
              Past maturity · {c.postMaturityCycles} mo × {peso(c.monthlyInterest)} = {peso(c.postMaturityInterest)} added
              {c.nextInterestDate && <span className="text-muted-foreground">· next charge {fmtDate(c.nextInterestDate)}</span>}
            </div>)}</div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && c.status !== 'Fully Paid' && <Button onClick={() => setPayOpen(true)}><Plus className="mr-2 h-4 w-4"/>Record payment</Button>}
          <Button variant="outline" onClick={() => printSOA(c, { ...sf.settings, creditorName: creditor })}><Printer className="mr-2 h-4 w-4"/>SOA</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => printPromissoryNote(c, { ...sf.settings, creditorName: creditor })}><FileText className="mr-2 h-4 w-4"/>Promissory note</DropdownMenuItem>
              <DropdownMenuItem onClick={() => printContract(c, { ...sf.settings, creditorName: creditor })}><FileSignature className="mr-2 h-4 w-4"/>Loan agreement</DropdownMenuItem>
              {isAdmin && <><DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => save.mutate({ table: 'loans', id: l.id, record: { earlySettlement: !l.earlySettlement } }, { onSuccess: () => toast.success(l.earlySettlement ? 'Early settlement removed' : 'Marked for early settlement') })}><Zap className="mr-2 h-4 w-4"/>{l.earlySettlement ? 'Remove early settlement' : 'Mark early settlement'}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeclOpen(true)}><Scale className="mr-2 h-4 w-4"/>Declare balance</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ table: 'loans', id: l.id })}><Trash2 className="mr-2 h-4 w-4"/>Delete loan</DropdownMenuItem></>}
            </DropdownMenuContent></DropdownMenu>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v], i) => <div key={k} className={`rounded-xl border p-4 shadow-sm ${i === 3 ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
          <div className={`text-xs font-semibold uppercase ${i === 3 ? 'opacity-80' : 'text-muted-foreground'}`}>{k}</div><div className="num mt-1 text-lg font-bold">{v}</div></div>)}
      </div>
      <CollectionBreakdown c={c}/>
      {(c.overdue || c.paidThrough) && <div className="mb-6 flex flex-wrap gap-3 text-sm">
        {c.overdue && <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">Overdue <b>{c.daysOverdue} days</b> since {fmtDate(c.nextDue)} · past due <b className="num">{peso(c.overdueAmount)}</b> · pending late fee <b className="num">{peso(c.pendingLateFee)}</b></div>}
        {c.paidThrough && <div className="rounded-lg border bg-muted/40 px-3 py-2">Interest paid through <b>{fmtDate(c.paidThrough)}</b> ({c.monthsPrepaid} mo)</div>}
      </div>}

      <div className="mb-6 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4 font-semibold">Payment ledger</div>
        <table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr>
          <th className="p-3">Date</th><th>Ref #</th><th className="text-right">Paid</th><th className="text-right">Interest</th><th className="text-right">Principal</th><th className="text-right">Late fee</th><th className="text-right">Principal bal.</th><th className="text-right">Cash collected</th><th /></tr></thead>
          <tbody>{c.ledger.map((x) => <tr key={x.id} className="border-t num">
            <td className="p-3 font-sans">{fmtDate(x.paidOn)}{x.prepayInterest && <span className="ml-1 text-[10px] text-primary">ADV</span>}{x.interest > 0 && x.principal <= 0 && <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-700">INTEREST ONLY</span>}</td><td className="font-sans text-xs">{x.referenceNo}</td>
            <td className="text-right font-semibold">{peso(x.amount)}</td><td className="text-right">{peso(x.interest)}</td><td className="text-right">{peso(x.principal)}</td><td className="text-right">{peso(x.lateFee)}</td>
            <td className="text-right">{peso(x.principalBalance)}</td><td className="text-right">{peso(x.cashCollected)}</td>
            <td className="whitespace-nowrap pr-2 text-right">
              {x.receiptUrl && <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Receipt"><a href={x.receiptUrl} target="_blank" rel="noreferrer"><Paperclip className="h-4 w-4"/></a></Button>}
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Copy for SMS" onClick={() => { navigator.clipboard.writeText(smsText(l, x, x.balance, creditor)); toast.success('Copied for SMS'); }}><Copy className="h-4 w-4"/></Button>
              {isAdmin && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirm({ table: 'payments', id: x.id })}><Trash2 className="h-4 w-4"/></Button>}
            </td></tr>)}
            {!c.ledger.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No payments yet.</td></tr>}</tbody></table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card shadow-sm"><div className="border-b p-4 font-semibold">Schedule · {c.installments} × {peso(c.installment)}</div>
          <div className="max-h-72 overflow-auto text-sm">{c.schedule.map((s, i) => {
            const last = i === c.schedule.length - 1;
            const met = (c.interestPaid + c.principalPaid) + 0.01 >= (last ? c.installment * i + c.finalInstallment : c.installment * (i + 1));
            return <div key={s} className="flex justify-between gap-3 border-b px-4 py-2 last:border-0"><span>#{i + 1} · {fmtDate(s)}{last && c.schedule.length > 1 && <span className="text-muted-foreground"> (final)</span>}</span><span className="flex gap-3"><span className="num">{peso(c.scheduleAmounts[i] > 0 ? c.scheduleAmounts[i] : (last ? c.finalInstallment : c.installment))}</span><span className={met ? 'text-primary' : s < phToday() ? 'text-destructive' : 'text-muted-foreground'}>{met ? 'Paid' : s < phToday() ? 'Due' : 'Upcoming'}</span></span></div>;
        })}</div></div>
        <div className="rounded-xl border bg-card shadow-sm"><div className="border-b p-4 font-semibold">Balance declarations</div>
          {decls.length ? decls.map((d) => <div key={d.id} className="border-b px-4 py-3 text-sm last:border-0"><div className="num font-medium">{peso(d.previousPrincipal)} → {peso(d.declaredPrincipal)} <span className="font-sans text-muted-foreground">as of {fmtDate(d.declaredAt)}</span></div>
            <div className="text-xs text-muted-foreground">{d.reason} · by {d.declaredBy}</div></div>) : <p className="p-6 text-sm text-muted-foreground">No declarations.</p>}</div>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} loan={l} payments={sf.payments} creditor={creditor}/>
      <DeclareDialog open={declOpen} onOpenChange={setDeclOpen} loanId={l.id} current={c.principalBalance}/>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this {confirm?.table === 'loans' ? 'loan and all its payments' : 'payment'}?</AlertDialogTitle><AlertDialogDescription>This is recorded in the audit log and can't be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirm && del.mutate(confirm, { onSuccess: () => { if (confirm.table === 'loans')
            nav('/sinking-fund/loans'); } })}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>);
}
