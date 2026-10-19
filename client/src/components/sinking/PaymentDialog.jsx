import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Loader2, Paperclip } from 'lucide-react';
import { useUpload } from '@/zite/upload';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { calcLoan, phToday } from '../../lib/loanCalc';
import { useSfSave } from '../../services/sf';
import { peso, fmtDate } from '../../utils/format';
export function smsText(loan, p, balance, creditor) {
    const ts = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    return `${creditor} — Payment Received\nBorrower: ${loan.borrowerName}\nDate paid: ${fmtDate(p.paidOn)}\nRef #: ${p.referenceNo || 'N/A'}\nAmount: ${peso(p.amount)}${p.lateFee ? `\nLate fee: ${peso(p.lateFee)}` : ''}\nRemaining balance: ${peso(balance)}\nIssued: ${ts} (PHT)\nSalamat po!`;
}
export default function PaymentDialog({ open, onOpenChange, loan, payments, creditor }) {
    const save = useSfSave();
    const { upload, isUploading } = useUpload();
    const [paidOn, setPaidOn] = useState(phToday());
    const [amount, setAmount] = useState('');
    const [lateFee, setLateFee] = useState('0');
    const [ref, setRef] = useState('');
    const [prepay, setPrepay] = useState(false);
    const [receipt, setReceipt] = useState('');
    const [done, setDone] = useState(null);
    useEffect(() => { if (open) {
        setPaidOn(phToday());
        setAmount('');
        setLateFee('0');
        setRef(`OR-${Date.now().toString().slice(-8)}`);
        setPrepay(false);
        setReceipt('');
        setDone(null);
    } }, [open]);
    const at = useMemo(() => calcLoan(loan, payments, paidOn || phToday()), [loan, payments, paidOn]);
    const amt = Number(amount) || 0;
    const after = useMemo(() => calcLoan(loan, [...payments, { id: 'new', loanId: loan.id, paidOn, amount: amt, lateFee: 0, prepayInterest: prepay, createdAt: '9' }], paidOn || phToday()), [loan, payments, paidOn, amt, prepay]);
    const valid = amt > 0 && /^\d{4}-\d{2}-\d{2}$/.test(paidOn) && amt <= at.balance + at.monthlyInterest * at.term + 0.01;
    const onFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            setReceipt((await upload(file)).url);
        }
        catch {
            toast.error('Upload failed');
        }
    };
    const submit = () => save.mutate({ table: 'payments', record: { loanId: loan.id, paidOn, amount: amt, lateFee: Number(lateFee) || 0, referenceNo: ref, receiptUrl: receipt, prepayInterest: prepay } }, {
        onSuccess: () => { toast.success('Payment recorded'); setDone(smsText(loan, { paidOn, amount: amt, lateFee: Number(lateFee) || 0, referenceNo: ref }, after.balance, creditor)); },
    });
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{done ? 'Payment recorded' : `Record payment — ${loan.borrowerName}`}</DialogTitle></DialogHeader>
        {done ? (<>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{done}</pre>
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={() => { navigator.clipboard.writeText(done); toast.success('Copied for SMS'); }}><Copy className="mr-2 h-4 w-4"/>Copy for SMS</Button></DialogFooter>
        </>) : (<>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center text-xs">
            <div><div className="text-muted-foreground">Balance on date</div><div className="num text-base font-bold">{peso(at.balance)}</div></div>
            <div><div className="text-muted-foreground">Interest due</div><div className="num text-base font-bold">{peso(at.accruedInterest)}</div></div>
            <div><div className="text-muted-foreground">Principal</div><div className="num text-base font-bold">{peso(at.principalBalance)}</div></div>
          </div>
          {at.overdue && (<div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive"/>
              <div className="flex-1">Overdue {at.daysOverdue} days ({peso(at.overdueAmount)} past due). Suggested {loan.penaltyRate}% late fee: <b className="num">{peso(at.pendingLateFee)}</b></div>
              <Button size="sm" variant="outline" onClick={() => setLateFee(String(at.pendingLateFee))}>Apply</Button>
            </div>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Payment date</Label><Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)}/></div>
            <div className="space-y-1.5"><Label>Reference no.</Label><Input value={ref} onChange={(e) => setRef(e.target.value)}/></div>
            <div className="space-y-1.5"><Label className="flex items-center justify-between gap-2">Amount (₱)<span className="flex gap-3">{at.balance > 0.009 && <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setAmount(String(Math.min(at.installment, at.balance)))}>Pay installment {peso(Math.min(at.installment, at.balance))}</button>}<button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setAmount(String(at.balance))}>Settle full balance</button></span></Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}/>
              {amount !== '' && !valid && <p className="text-xs text-destructive">Enter an amount greater than 0.</p>}</div>
            <div className="space-y-1.5"><Label>Late fee (₱)</Label><Input type="number" step="0.01" value={lateFee} onChange={(e) => setLateFee(e.target.value)}/></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={prepay} onCheckedChange={(v) => setPrepay(!!v)}/>Advance interest payment (apply to future months' interest first)</label>
          <div className="space-y-1.5"><Label>Proof of payment</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/40">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Paperclip className="h-4 w-4"/>}{receipt ? 'Replace receipt' : 'Upload receipt image'}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} disabled={isUploading}/></label>
            {receipt && <img src={receipt} alt="Receipt" className="max-h-40 rounded-lg border object-contain"/>}</div>
          {amt > 0 && <p className="text-sm text-muted-foreground">Balance after this payment: <b className="num text-foreground">{peso(after.balance)}</b>{after.paidThrough && prepay && <> · interest paid through {fmtDate(after.paidThrough)}</>}</p>}
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!valid || save.isPending || isUploading}>{save.isPending ? 'Saving…' : 'Record payment'}</Button></DialogFooter>
        </>)}
      </DialogContent>
    </Dialog>);
}
