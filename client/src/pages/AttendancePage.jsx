import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Button } from '@/shared/ui/button';
import { ListChecks } from 'lucide-react';
import BulkAttendanceDialog from '../components/BulkAttendanceDialog';
import AttendanceBulkActions from '../components/AttendanceBulkActions';
import CrudPage from '../components/CrudPage';
import StatusBadge from '../components/StatusBadge';
import { useNameMap, useRecords } from '../services/records';
import { fmtDate, firstId } from '../utils/format';
import { syncDraftPayrollAttendance } from '@/zite/api';
import { toast } from 'sonner';
import { useRole } from '../services/role';
const SHIFT_START = '08:00';
function lateFrom(timeIn) {
    if (!timeIn || !/^\d{2}:\d{2}$/.test(timeIn))
        return 0;
    const [h, m] = timeIn.split(':').map(Number);
    const [sh, sm] = SHIFT_START.split(':').map(Number);
    return Math.max(0, h * 60 + m - (sh * 60 + sm));
}
export default function AttendancePage() {
    const qc = useQueryClient();
    const { isAdmin } = useRole();
    const emps = useNameMap('employees');
    const [status, setStatus] = useState('all');
    const [bulkOpen, setBulkOpen] = useState(false);
    const selectionActions = useCallback((rows, clear) => <AttendanceBulkActions rows={rows} clear={clear}/>, []);
    const columns = useMemo(() => [
        { accessorKey: 'workDate', header: 'Date', cell: ({ getValue }) => <span className="font-medium">{fmtDate(getValue())}</span> },
        { id: 'emp', header: 'Employee', accessorFn: (r) => emps.map[firstId(r.employee) ?? ''] ?? '—' },
        { accessorKey: 'timeIn', header: 'In', cell: ({ getValue }) => <span className="num">{getValue() || '—'}</span> },
        { accessorKey: 'timeOut', header: 'Out', cell: ({ getValue }) => <span className="num">{getValue() || '—'}</span> },
        { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
        { accessorKey: 'dayType', header: 'Day Type', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
        { accessorKey: 'lateMinutes', header: 'Late (min)', cell: ({ getValue }) => {
                const v = Number(getValue() ?? 0);
                return <span className={v > 0 ? 'num font-semibold text-destructive' : 'num text-muted-foreground'}>{v}</span>;
            } },
        { accessorKey: 'overtimeHours', header: 'OT (h)', cell: ({ row }) => row.original.overtimePayMode === 'Fixed Amount' ? <span className="num">Fixed: ₱{Number(row.original.overtimeAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span> : <span className="num">{Number(row.original.overtimeHours ?? 0)}</span> },
        { accessorKey: 'otherBenefit', header: 'Other Benefit', cell: ({ getValue }) => <span className="num">₱{Number(getValue() ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span> },
        { accessorKey: 'nightDiffHours', header: 'ND (h)', cell: ({ getValue }) => <span className="num">{Number(getValue() ?? 0)}</span> },
    ], [emps.map]);
    const fields = useMemo(() => [
        { key: 'employee', label: 'Employee', type: 'link', required: true, linkOptions: emps.list.filter((e) => e.active !== false).map((e) => ({ id: e.id, name: e.fullName })) },
        { key: 'workDate', label: 'Work Date', type: 'date', required: true },
        { key: 'timeIn', label: 'Time In', type: 'time' },
        { key: 'timeOut', label: 'Time Out', type: 'time' },
        { key: 'status', label: 'Status', type: 'select', options: ['Present', 'Halfday', 'Absent', 'Paid Leave', 'Rest Day'], required: true, defaultValue: 'Present' },
        { key: 'dayType', label: 'Day Type', type: 'select', options: ['Regular Day', 'Regular Holiday', 'Special Non-Working', 'Rest Day'], required: true, defaultValue: 'Regular Day' },
        { key: 'lateMinutes', label: 'Late Minutes (auto from 8:00 AM if blank)', type: 'number' },
        { key: 'overtimeHours', label: 'Overtime Hours (optional; used when mode is Hours)', type: 'number' },
        { key: 'overtimePayMode', label: 'Overtime Pay Mode (optional)', type: 'select', options: ['Hours', 'Fixed Amount'], defaultValue: 'Hours' },
        { key: 'overtimeAmount', label: 'Overtime Fixed Amount (₱, optional)', type: 'number' },
        { key: 'otherBenefit', label: 'Other Benefit (₱)', type: 'number', full: true, defaultValue: 0 },
        { key: 'nightDiffHours', label: 'Night Diff Hours (10PM–6AM)', type: 'number' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ], [emps.list]);
    const filter = useCallback((r) => status === 'all' || r.status === status, [status]);
    const beforeSave = useCallback((v) => ({
        ...v,
        lateMinutes: v.lateMinutes ?? (['Present', 'Halfday'].includes(v.status) ? lateFrom(v.timeIn) : 0),
        otherBenefit: v.otherBenefit == null || v.otherBenefit === '' ? 0 : Number(v.otherBenefit),
        overtimeHours: v.overtimeHours == null || v.overtimeHours === '' ? 0 : Number(v.overtimeHours),
        overtimeAmount: v.overtimeAmount == null || v.overtimeAmount === '' ? 0 : Number(v.overtimeAmount),
        nightDiffHours: v.nightDiffHours == null || v.nightDiffHours === '' ? 0 : Number(v.nightDiffHours),
    }), []);
    const { data: attendanceList = [] } = useRecords('attendance');
    const validate = useCallback((values, editing) => {
        const empId = firstId(values.employee);
        const date = String(values.workDate ?? '').slice(0, 10);
        if (!empId || !date) return {};
        const match = attendanceList.find((a) => {
            const aEmp = firstId(a.employee);
            const aDate = String(a.workDate ?? '').slice(0, 10);
            return aEmp === empId && aDate === date && a.id !== editing?.id;
        });
        if (match) {
            const empName = emps.map[empId] ?? 'This employee';
            return {
                workDate: `Attendance for ${empName} on ${date} already exists (${match.status}). Duplication is strictly prevented.`,
            };
        }
        return {};
    }, [attendanceList, emps.map]);

    const afterSave = useCallback((v) => {
        if (!isAdmin)
            return;
        const employeeId = firstId(v.employee);
        const workDate = String(v.workDate ?? '').slice(0, 10);
        if (!employeeId || !workDate)
            return;
        void syncDraftPayrollAttendance({ employeeId, workDate }).then((result) => {
            if (result.updated > 0) {
                qc.invalidateQueries({ queryKey: ['records', 'payslips'] });
                toast.success(`Updated ${result.updated} draft payroll record${result.updated === 1 ? '' : 's'} from attendance changes`);
            }
        }).catch((error) => toast.error(`Attendance saved, but draft payroll refresh failed: ${error.message}`));
    }, [isAdmin, qc]);
    return <CrudPage table="attendance" title="Attendance" singular="Log" description={`Daily time records with strict deduplication (one log per employee per date). Shift starts ${SHIFT_START} AM — lates are computed automatically.`} columns={columns} fields={fields} filter={filter} sort={useCallback((a, b) => { const rank = (s) => (s === 'Present' ? 0 : 1); const r = rank(a.status) - rank(b.status); if (r !== 0) return r; return String(a.workDate ?? '').localeCompare(String(b.workDate ?? '')); }, [])} validate={validate} beforeSave={beforeSave} afterSave={afterSave} selectionActions={selectionActions} headerActions={<>
      <Button variant="outline" onClick={() => setBulkOpen(true)}><ListChecks className="mr-2 h-4 w-4"/>Bulk log</Button>
      <BulkAttendanceDialog open={bulkOpen} onOpenChange={setBulkOpen} employees={emps.list} lateFrom={lateFrom}/>
    </>} toolbar={<Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="Present">Present</SelectItem>
          <SelectItem value="Halfday">Halfday</SelectItem>
          <SelectItem value="Absent">Absent</SelectItem>
          <SelectItem value="Paid Leave">Paid Leave</SelectItem>
          <SelectItem value="Rest Day">Rest Day</SelectItem>
        </SelectContent>
      </Select>}/>;
}
