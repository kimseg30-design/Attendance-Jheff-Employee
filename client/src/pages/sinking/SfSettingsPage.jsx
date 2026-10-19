import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { sfClearData } from '@/zite/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import PageHeader from '../../components/PageHeader';
import { useSf, useSfSave } from '../../services/sf';
import { useRole } from '../../services/role';
const FIELDS = [
    ['creditorName', 'Creditor / fund name (printed on documents)', 'text'], ['creditorAddress', 'Creditor address', 'text'],
    ['defaultMonthlyRate', 'Default interest per month (%)', 'number'], ['defaultPenaltyRate', 'Default late penalty (%)', 'number'], ['defaultGraceDays', 'Default grace period (days)', 'number'],
];
const TARGETS = [
    { value: 'loans', label: 'Loans', detail: 'Deletes loans and their linked payments and balance declarations.' },
    { value: 'contributions', label: 'Contributions', detail: 'Deletes contribution records only.' },
    { value: 'members', label: 'Members', detail: 'Deletes members, their contributions, loans, linked payments and balance declarations.' },
    { value: 'all', label: 'All Data', detail: 'Deletes all members, contributions, loans, payments and balance declarations.' },
];
export default function SfSettingsPage() {
    const sfData = useSf();
    const { isAdmin, isLoading } = useRole();
    const save = useSfSave();
    const qc = useQueryClient();
    const [v, setV] = useState({});
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState('loans');
    const [confirmation, setConfirmation] = useState('');
    const clearData = useMutation({
        mutationFn: () => sfClearData({ target: deleteTarget, confirmation: 'DELETE' }),
        onSuccess: async (result) => {
            await qc.invalidateQueries({ queryKey: ['sf'] });
            await qc.invalidateQueries({ queryKey: ['sfAudit'] });
            toast.success('Deleted data: ' + result.deleted.join(', '));
            setDeleteOpen(false);
            setConfirmation('');
        },
        onError: (e) => toast.error(e.message || 'Could not delete selected data'),
    });
    useEffect(() => { setV(sfData.settings); }, [sfData.settings]);
    if (!isLoading && !isAdmin)
        return <Navigate to="/sinking-fund" replace/>;
    const ok = String(v.creditorName ?? '').trim() && [v.defaultMonthlyRate, v.defaultPenaltyRate, v.defaultGraceDays].every((n) => n !== '' && Number(n) >= 0);
    const selected = TARGETS.find((t) => t.value === deleteTarget);
    return (<div>
      <PageHeader title="Sinking Fund Settings" description="Defaults for new loans and the details printed on SOAs, promissory notes and contracts. All dates use Philippine time (UTC+8)."/>
      <div className="mb-5 max-w-xl rounded-xl border border-destructive/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 text-destructive"/>
          <div className="flex-1">
            <h2 className="font-semibold">Delete Sinking Fund Data</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose which operational records to remove. Settings and audit history are preserved.</p>
          </div>
          <Button variant="destructive" onClick={() => { setConfirmation(''); setDeleteOpen(true); }}><Trash2 className="mr-2 h-4 w-4"/>Delete Data</Button>
        </div>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!clearData.isPending)
        setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive"/>Delete Sinking Fund Data?</AlertDialogTitle>
            <AlertDialogDescription>This action permanently deletes selected records. Please check the scope carefully before confirming.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <RadioGroup value={deleteTarget} onValueChange={(value) => { setDeleteTarget(value); setConfirmation(''); }}>
              {TARGETS.map((target) => <label key={target.value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value={target.value} className="mt-1"/>
                <span><span className="block font-medium">{target.label}</span><span className="block text-xs text-muted-foreground">{target.detail}</span></span>
              </label>)}
            </RadioGroup>
            <div className="rounded-md bg-destructive/10 p-3 text-sm"><b>Selected: {selected.label}</b><p className="mt-1">{selected.detail}</p><p className="mt-1">The Settings and Audit Log will not be deleted.</p></div>
            <div className="space-y-1.5">
              <Label>Type DELETE to confirm</Label>
              <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="DELETE" autoComplete="off"/>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearData.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={confirmation !== 'DELETE' || clearData.isPending} onClick={(e) => { e.preventDefault(); clearData.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearData.isPending ? 'Deleting…' : 'Delete selected data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {sfData.isLoading ? <Skeleton className="h-72 max-w-xl rounded-xl"/> : (<div className="max-w-xl space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          {FIELDS.map(([k, label, type]) => <div key={k} className="space-y-1.5"><Label>{label}</Label><Input type={type} step="0.01" value={v[k] ?? ''} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))}/></div>)}
          <Button disabled={!ok || save.isPending} onClick={() => save.mutate({ table: 'settings', record: {
                    creditorName: v.creditorName, creditorAddress: v.creditorAddress, defaultMonthlyRate: Number(v.defaultMonthlyRate), defaultPenaltyRate: Number(v.defaultPenaltyRate), defaultGraceDays: Number(v.defaultGraceDays),
                } }, { onSuccess: () => toast.success('Settings saved') })}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
        </div>)}
    </div>);
}
