import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/shared/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarX, Coffee, Loader2, Plane, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveRecord, deleteRecord } from '@/zite/api';
export default function AttendanceBulkActions({ rows, clear }) {
    const qc = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const run = async (fn, msg) => {
        setBusy(true);
        try {
            await Promise.all(rows.map(fn));
            toast.success(msg);
            clear();
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['records', 'attendance'] }),
                qc.invalidateQueries({ queryKey: ['records', 'employees'] }),
                qc.invalidateQueries({ queryKey: ['dashboard'] }),
            ]);
        }
        catch (e) {
            toast.error(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    const mark = (status) => run((r) => saveRecord({ table: 'attendance', id: r.id, record: { status, ...(!['Present', 'Halfday'].includes(status) ? { lateMinutes: 0, overtimeHours: 0, nightDiffHours: 0 } : {}) } }), `Marked ${rows.length} as ${status}`);
    return (<>
      <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => mark('Present')}><CalendarCheck className="mr-1.5 h-3.5 w-3.5"/>Present</Button>
      <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => mark('Halfday')}><CalendarCheck className="mr-1.5 h-3.5 w-3.5"/>Halfday</Button>
      <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => mark('Absent')}><CalendarX className="mr-1.5 h-3.5 w-3.5"/>Absent</Button>
      <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => mark('Paid Leave')}><Plane className="mr-1.5 h-3.5 w-3.5"/>Paid Leave</Button>
      <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => mark('Rest Day')}><Coffee className="mr-1.5 h-3.5 w-3.5"/>Rest Day</Button>
      <Button size="sm" variant="outline" className="h-8 text-destructive" disabled={busy} onClick={() => setConfirm(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5"/>Delete</Button>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {rows.length} attendance logs?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => run((r) => deleteRecord({ table: 'attendance', id: r.id }), `Deleted ${rows.length} logs`)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);
}
