import { useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/ui/alert-dialog';
import PageHeader from '../../components/PageHeader';
import { useSf, useSfDelete, useSfSave } from '../../services/sf';
import { useRole } from '../../services/role';
import { phToday } from '../../lib/loanCalc';
import { peso, fmtDate } from '../../utils/format';
export default function SfContributionsPage() {
    const sf = useSf();
    const { isAdmin } = useRole();
    const save = useSfSave();
    const del = useSfDelete();
    const [member, setMember] = useState('all');
    const [open, setOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [v, setV] = useState({});
    const [bulkDate, setBulkDate] = useState(phToday());
    const [bulkRef, setBulkRef] = useState('');
    const [bulkNotes, setBulkNotes] = useState('');
    const [bulkAmounts, setBulkAmounts] = useState({});
    const [bulkUniform, setBulkUniform] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);
    const rows = sf.contributions.filter((c) => member === 'all' || c.memberId === member).sort((a, b) => b.contributedOn.localeCompare(a.contributedOn));
    const total = rows.reduce((a, c) => a + Number(c.amount), 0);
    const contributionWeeks = new Set(rows.map((c) => {
        const sourceDate = String(c.payrollPeriodStart || c.contributedOn || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate))
            return '';
        const d = new Date(`${sourceDate}T12:00:00`);
        const day = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - day);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }).filter(Boolean)).size;
    const ok = v.memberId && Number(v.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(v.contributedOn ?? '');
    const active = sf.members.filter((m) => m.status === 'Active');
    const bulkRows = active.map((m) => ({ ...m, amount: bulkAmounts[m.id] ?? String(Number(m.baseContribution) || 0) }));
    const bulkTotal = bulkRows.reduce((sum, m) => sum + (Number(m.amount) > 0 ? Number(m.amount) : 0), 0);
    const bulkCount = bulkRows.filter((m) => Number(m.amount) > 0).length;
    const startBulk = () => {
        setBulkDate(phToday());
        setBulkRef('');
        setBulkNotes('');
        setBulkUniform('');
        setBulkAmounts(Object.fromEntries(active.map((m) => [m.id, String(Number(m.baseContribution) || 0)])));
        setBulkOpen(true);
    };
    const applyUniform = () => {
        const amount = Number(bulkUniform);
        if (!(amount > 0)) {
            toast.error('Enter a bulk amount greater than zero');
            return;
        }
        setBulkAmounts(Object.fromEntries(active.map((m) => [m.id, String(amount)])));
    };
    const submitBulk = async () => {
        const entries = bulkRows.filter((m) => Number(m.amount) > 0);
        if (!entries.length) {
            toast.error('Enter an amount for at least one member');
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bulkDate)) {
            toast.error('Choose a valid contribution date');
            return;
        }
        setBulkSaving(true);
        let saved = 0;
        try {
            for (const m of entries) {
                await save.mutateAsync({ table: 'contributions', record: { memberId: m.id, amount: Number(m.amount), contributedOn: bulkDate, referenceNo: bulkRef, notes: bulkNotes } });
                saved++;
            }
            toast.success(`Bulk contribution saved for ${saved} member${saved === 1 ? '' : 's'} — ${peso(entries.reduce((sum, m) => sum + Number(m.amount), 0))}`);
            setBulkOpen(false);
        }
        catch {
            toast.error(`Saved ${saved} of ${entries.length}. Please check the contribution list before retrying to avoid duplicates.`);
        }
        finally {
            setBulkSaving(false);
        }
    };
    return (<div>
      <PageHeader title="Contributions" description="Member capital deposits that make up the lending fund." actions={isAdmin && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!active.length} onClick={startBulk}><Users className="mr-2 h-4 w-4"/>Bulk add</Button><Button disabled={!active.length} onClick={() => { setV({ contributedOn: phToday(), memberId: member !== 'all' ? member : undefined }); setOpen(true); }}><Plus className="mr-2 h-4 w-4"/>Log contribution</Button></div>}/>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select value={member} onValueChange={setMember}><SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All members</SelectItem>{sf.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}</SelectContent></Select>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"><div>Total weeks: <b className="num text-primary">{contributionWeeks}</b></div><div>Total contributions: <b className="num text-primary">{peso(total)}</b></div></div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {sf.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10"/>)}</div> :
            <table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Date</th><th>Member</th><th>Payroll coverage</th><th>Reference</th><th>Notes</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>{rows.map((c) => <tr key={c.id} className="border-t"><td className="p-3">{fmtDate(c.contributedOn)}</td><td className="font-medium">{sf.memberName[c.memberId] ?? '—'}</td>
              <td className="whitespace-nowrap text-muted-foreground">{c.payrollPeriodStart && c.payrollPeriodEnd ? `${fmtDate(c.payrollPeriodStart)} – ${fmtDate(c.payrollPeriodEnd)}` : '—'}</td><td className="text-muted-foreground">{c.referenceNo || '—'}</td><td className="text-muted-foreground">{c.notes || ''}</td><td className="num text-right font-semibold">{peso(c.amount)}</td>
              <td className="pr-2 text-right">{isAdmin && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4"/></Button>}</td></tr>)}
              {!rows.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">{sf.members.length ? 'No contributions yet.' : 'Add members first, then log their contributions.'}</td></tr>}</tbody></table>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Log contribution</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Member</Label><Select value={v.memberId ?? ''} onValueChange={(m) => setV((x) => ({ ...x, memberId: m }))}><SelectTrigger><SelectValue placeholder="Choose member"/></SelectTrigger>
            <SelectContent>{active.map((m) => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Amount (₱)</Label><Input type="number" min="0" step="0.01" value={v.amount ?? ''} onChange={(e) => setV((x) => ({ ...x, amount: e.target.value }))}/></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={v.contributedOn ?? ''} onChange={(e) => setV((x) => ({ ...x, contributedOn: e.target.value }))}/></div>
          <div className="space-y-1.5"><Label>Reference no.</Label><Input value={v.referenceNo ?? ''} onChange={(e) => setV((x) => ({ ...x, referenceNo: e.target.value }))}/></div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={v.notes ?? ''} onChange={(e) => setV((x) => ({ ...x, notes: e.target.value }))}/></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!ok || save.isPending} onClick={() => save.mutate({ table: 'contributions', record: { ...v, amount: Number(v.amount) } }, { onSuccess: () => { toast.success('Contribution logged'); setOpen(false); } })}>Save</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={bulkOpen} onOpenChange={(o) => !bulkSaving && setBulkOpen(o)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Bulk add contributions</DialogTitle><DialogDescription>Amounts are pre-filled from each member's base contribution. Leave an amount at ₱0 to skip that member.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Contribution date</Label><Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}/></div>
          <div className="space-y-1.5"><Label>Same amount for everyone (optional)</Label><div className="flex gap-2"><Input type="number" min="0" step="0.01" placeholder="e.g. 100" value={bulkUniform} onChange={(e) => setBulkUniform(e.target.value)}/><Button type="button" variant="secondary" onClick={applyUniform}>Apply</Button></div></div>
          <div className="space-y-1.5"><Label>Reference no. (optional)</Label><Input value={bulkRef} onChange={(e) => setBulkRef(e.target.value)}/></div>
          <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)}/></div>
        </div>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/40 p-3 text-sm"><span>{bulkCount} of {active.length} members included</span><b className="num">{peso(bulkTotal)}</b></div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {bulkRows.map((m) => <div key={m.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{m.fullName}</div><div className="text-xs text-muted-foreground">Base: {peso(m.baseContribution ?? 0)}</div></div>
              <div className="w-32 shrink-0"><Input aria-label={`Contribution amount for ${m.fullName}`} type="number" min="0" step="0.01" value={m.amount} onChange={(e) => setBulkAmounts((x) => ({ ...x, [m.id]: e.target.value }))}/></div></div>)}
            {!active.length && <p className="p-6 text-center text-sm text-muted-foreground">No active members to add.</p>}
          </div>
        </div>
        <DialogFooter><Button variant="outline" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>Cancel</Button><Button disabled={!bulkCount || bulkSaving} onClick={submitBulk}>{bulkSaving ? 'Saving…' : `Save ${bulkCount} contributions`}</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this contribution?</AlertDialogTitle><AlertDialogDescription>{peso(deleting?.amount)} from {sf.memberName[deleting?.memberId] ?? 'member'}. This is recorded in the audit log.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && del.mutate({ table: 'contributions', id: deleting.id })}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>);
}
