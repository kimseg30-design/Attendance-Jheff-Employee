import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/ui/alert-dialog';
import PageHeader from '../../components/PageHeader';
import { useSf, useSfDelete, useSfSave } from '../../services/sf';
import { useRole } from '../../services/role';
import { useRecords } from '../../services/records';
import { phToday } from '../../lib/loanCalc';
import { peso, fmtDate } from '../../utils/format';
function MemberDialog({ open, onOpenChange, initial }) {
    const save = useSfSave();
    const { data: employees = [] } = useRecords('employees');
    const [v, setV] = useState({});
    const [last, setLast] = useState(undefined);
    if (open && last !== initial) {
        setLast(initial);
        setV(initial ?? { status: 'Active', joinedOn: phToday() });
    }
    const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
    const emailOk = !v.email || /^\S+@\S+\.\S+$/.test(v.email);
    const ok = String(v.fullName ?? '').trim().length >= 2 && emailOk;
    return (<Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o)
        setLast(undefined); }}><DialogContent>
      <DialogHeader><DialogTitle>{initial ? 'Edit member' : 'New member'}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Full name</Label><Input value={v.fullName ?? ''} onChange={set('fullName')}/></div>
        <div className="space-y-1.5"><Label>Contact no.</Label><Input value={v.contactNo ?? ''} onChange={set('contactNo')}/></div>
        <div className="space-y-1.5"><Label>Email</Label><Input value={v.email ?? ''} onChange={set('email')}/>{!emailOk && <p className="text-xs text-destructive">Enter a valid email</p>}</div>
        <div className="space-y-1.5"><Label>Status</Label><Select value={v.status ?? 'Active'} onValueChange={(s) => setV((x) => ({ ...x, status: s }))}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Joined on</Label><Input type="date" value={v.joinedOn ?? ''} onChange={set('joinedOn')}/></div>
        <div className="space-y-1.5"><Label>Linked employee</Label><Select value={String(v.employeeId ?? '') || 'none'} onValueChange={(employeeId) => setV((x) => ({ ...x, employeeId: employeeId === 'none' ? null : employeeId }))}><SelectTrigger><SelectValue placeholder="Select employee"/></SelectTrigger><SelectContent><SelectItem value="none">Not linked</SelectItem>{employees.filter((e) => e.active !== false).map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}{e.employeeNo ? ` · ${e.employeeNo}` : ''}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Base contribution per week (₱)</Label><Input type="number" min="0" step="0.01" value={v.baseContribution ?? ''} onChange={set('baseContribution')} placeholder="e.g. 100"/></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Input value={v.notes ?? ''} onChange={set('notes')}/></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={!ok || save.isPending} onClick={() => save.mutate({ table: 'members', id: initial?.id, record: { fullName: v.fullName, contactNo: v.contactNo, email: v.email, status: v.status ?? 'Active', joinedOn: v.joinedOn, employeeId: v.employeeId || null, baseContribution: Math.max(0, Number(v.baseContribution) || 0), notes: v.notes } }, { onSuccess: () => { toast.success('Member saved'); onOpenChange(false); setLast(undefined); } })}>Save</Button></DialogFooter>
    </DialogContent></Dialog>);
}
export default function SfMembersPage() {
    const sf = useSf();
    const { isAdmin } = useRole();
    const del = useSfDelete();
    const [q, setQ] = useState('');
    const [editing, setEditing] = useState(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const totals = useMemo(() => sf.contributions.reduce((a, c) => ({ ...a, [c.memberId]: (a[c.memberId] ?? 0) + Number(c.amount) }), {}), [sf.contributions]);
    const fund = Object.values(totals).reduce((a, b) => a + b, 0);
    const rows = sf.members.filter((m) => String(m.fullName).toLowerCase().includes(q.toLowerCase()));
    return (<div>
      <PageHeader title="Members" description={`Member capital fund: ${peso(fund)} from ${sf.members.filter((m) => m.status === 'Active').length} active members`} actions={isAdmin && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4"/>Add member</Button>}/>
      <div className="relative mb-4 w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-8" placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)}/></div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {sf.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10"/>)}</div> :
            <table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Name</th><th>Contact</th><th>Joined</th><th>Status</th><th className="text-right">Base contribution</th><th className="text-right">Capital</th><th className="text-right">Share</th><th /></tr></thead>
            <tbody>{rows.map((m) => <tr key={m.id} className="border-t">
              <td className="p-3 font-medium">{m.fullName}</td><td className="text-muted-foreground">{[m.contactNo, m.email].filter(Boolean).join(' · ') || '—'}</td><td>{fmtDate(m.joinedOn)}</td>
              <td><Badge variant={m.status === 'Active' ? 'default' : 'secondary'}>{m.status}</Badge></td>
              <td className="num text-right">{peso(m.baseContribution ?? 0)}</td><td className="num text-right font-semibold">{peso(totals[m.id] ?? 0)}</td><td className="num text-right">{fund ? (((totals[m.id] ?? 0) / fund) * 100).toFixed(1) : '0.0'}%</td>
              <td className="pr-2 text-right">{isAdmin && <><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(m)}><Trash2 className="h-4 w-4"/></Button></>}</td></tr>)}
              {!rows.length && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No members yet.</td></tr>}</tbody></table>}
      </div>
      <MemberDialog open={open} onOpenChange={setOpen} initial={editing}/>
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete {deleting?.fullName}?</AlertDialogTitle><AlertDialogDescription>Their contributions will be deleted too. Consider marking them Inactive instead.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && del.mutate({ table: 'members', id: deleting.id })}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>);
}
