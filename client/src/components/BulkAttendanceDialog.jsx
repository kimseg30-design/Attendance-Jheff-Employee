import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { DatePicker } from '@/shared/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { bulkLogAttendance, syncDraftPayrollAttendance } from '@/zite/api';
import { toISODate } from '../utils/format';
function Sel({ value, onChange, options }) {
    return (<Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>);
}
export default function BulkAttendanceDialog({ open, onOpenChange, employees, lateFrom }) {
    const active = useMemo(() => employees.filter((e) => e.active !== false), [employees]);
    const [selected, setSelected] = useState(new Set());
    const [search, setSearch] = useState('');
    const [date, setDate] = useState(new Date());
    const [status, setStatus] = useState('Present');
    const [dayType, setDayType] = useState('Regular Day');
    const [timeIn, setTimeIn] = useState('08:00');
    const [timeOut, setTimeOut] = useState('17:00');
    const qc = useQueryClient();
    useEffect(() => { if (open) {
        setSelected(new Set(active.map((e) => e.id)));
        setSearch('');
    } }, [open, active]);
    const shown = active.filter((e) => `${e.fullName} ${e.employeeNo ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    const allChecked = shown.length > 0 && shown.every((e) => selected.has(e.id));
    const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id))
        n.delete(id);
    else
        n.add(id); return n; });
    const toggleAll = () => setSelected((s) => {
        const n = new Set(s);
        shown.forEach((e) => (allChecked ? n.delete(e.id) : n.add(e.id)));
        return n;
    });
    const run = useMutation({
        mutationFn: () => bulkLogAttendance({
            employeeIds: [...selected], workDate: toISODate(date), status, dayType, timeIn, timeOut, lateMinutes: lateFrom(timeIn),
        }),
        onSuccess: async (r) => { qc.invalidateQueries(); toast.success(`Logged attendance for ${r.created} employees`); onOpenChange(false); try {
            const workDate = toISODate(date);
            const refreshed = await Promise.all([...selected].map((employeeId) => syncDraftPayrollAttendance({ employeeId, workDate })));
            const updated = refreshed.reduce((sum, x) => sum + x.updated, 0);
            if (updated)
                toast.success(`Refreshed ${updated} draft payroll record${updated === 1 ? '' : 's'}`);
        }
        catch {
            toast.error('Attendance logged, but some draft payroll records may need refreshing.');
        } },
        onError: (e) => toast.error(e.message),
    });
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk log attendance</DialogTitle>
          <DialogDescription>Tick the employees, set the day details, and log them all at once.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Work Date</Label><DatePicker value={date} onChange={setDate}/></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Status</Label><Sel value={status} onChange={(v) => setStatus(v)} options={['Present', 'Halfday', 'Absent', 'Paid Leave', 'Rest Day']}/></div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Day Type</Label><Sel value={dayType} onChange={(v) => setDayType(v)} options={['Regular Day', 'Regular Holiday', 'Special Non-Working', 'Rest Day']}/></div>
          {['Present', 'Halfday'].includes(status) && (<div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Time In</Label><Input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)}/></div>
              <div className="space-y-1.5"><Label className="text-xs font-semibold">Time Out</Label><Input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)}/></div>
            </div>)}
        </div>
        <div className="rounded-lg border">
          <div className="flex items-center gap-3 border-b px-3 py-2">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all"/>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter employees…" className="h-8 border-none pl-7 shadow-none focus-visible:ring-0"/>
            </div>
            <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">{selected.size} selected</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {shown.map((e) => (<label key={e.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)}/>
                <span className="flex-1 truncate font-medium">{e.fullName}</span>
                <span className="num text-xs text-muted-foreground">{e.employeeNo}</span>
              </label>))}
            {!shown.length && <p className="p-4 text-center text-sm text-muted-foreground">No employees found</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selected.size || !date || run.isPending} onClick={() => run.mutate()}>
            {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Log {selected.size} employee{selected.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
