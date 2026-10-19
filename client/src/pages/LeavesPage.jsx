import { useCallback, useMemo } from 'react';
import { Button } from '@/shared/ui/button';
import { Check, X } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import CrudPage from '../components/CrudPage';
import StatusBadge from '../components/StatusBadge';
import { useNameMap, useSaveRecord } from '../services/records';
import { fmtDate, firstId } from '../utils/format';
export default function LeavesPage() {
    const emps = useNameMap('employees');
    const saveLeave = useSaveRecord('leaves');
    const decide = useCallback(async (r, status) => {
        await saveLeave.mutateAsync({ id: r.id, record: { status } });
        toast.success(`Leave ${status.toLowerCase()}`);
    }, [saveLeave]);
    const rowActions = useCallback((r) => r.status === 'Pending' ? (<>
      <Button size="sm" variant="outline" className="h-8" disabled={saveLeave.isPending} onClick={() => decide(r, 'Approved')}><Check className="mr-1 h-3.5 w-3.5"/>Approve</Button>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={saveLeave.isPending} onClick={() => decide(r, 'Rejected')}><X className="h-4 w-4"/></Button>
    </>) : null, [decide, saveLeave.isPending]);
    const columns = useMemo(() => [
        { id: 'emp', header: 'Employee', accessorFn: (r) => emps.map[firstId(r.employee) ?? ''] ?? '—', cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> },
        { accessorKey: 'leaveType', header: 'Type', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
        { accessorKey: 'startDate', header: 'From', cell: ({ getValue }) => fmtDate(getValue()) },
        { accessorKey: 'endDate', header: 'To', cell: ({ getValue }) => fmtDate(getValue()) },
        { accessorKey: 'days', header: 'Days', cell: ({ getValue }) => <span className="num">{Number(getValue() ?? 0)}</span> },
        { accessorKey: 'leaveReason', header: 'Reason', cell: ({ getValue }) => <span className="block max-w-[220px] truncate text-muted-foreground">{getValue() || '—'}</span> },
        { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
    ], [emps.map]);
    const fields = useMemo(() => [
        { key: 'employee', label: 'Employee', type: 'link', required: true, linkOptions: emps.list.map((e) => ({ id: e.id, name: e.fullName })) },
        { key: 'leaveType', label: 'Leave Type', type: 'select', required: true, options: ['Vacation Leave', 'Sick Leave', 'Maternity/Paternity', 'Leave Without Pay'] },
        { key: 'startDate', label: 'Start Date', type: 'date', required: true },
        { key: 'endDate', label: 'End Date', type: 'date', required: true },
        { key: 'days', label: 'Days (auto if blank)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'], defaultValue: 'Pending', required: true },
        { key: 'leaveReason', label: 'Reason', type: 'text', full: true },
    ], [emps.list]);
    const beforeSave = useCallback((v) => ({
        ...v,
        days: v.days ?? (v.startDate && v.endDate ? differenceInCalendarDays(parseISO(v.endDate), parseISO(v.startDate)) + 1 : 1),
    }), []);
    return <CrudPage table="leaves" title="Leaves" singular="Leave" description="File, approve and track leave. Approved paid leave deducts from credits." columns={columns} fields={fields} rowActions={rowActions} beforeSave={beforeSave}/>;
}
