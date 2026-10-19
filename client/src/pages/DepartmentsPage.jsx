import { useMemo } from 'react';
import CrudPage from '../components/CrudPage';
import { firstId } from '../utils/format';
import { useRecords } from '../services/records';
const fields = [
    { key: 'departmentName', label: 'Department Name', type: 'text', required: true, full: true },
    { key: 'description', label: 'Description', type: 'textarea' },
];
export default function DepartmentsPage() {
    const { data: employees = [] } = useRecords('employees');
    const byDept = useMemo(() => {
        const m = {};
        for (const e of employees) {
            const d = firstId(e.department);
            if (!d)
                continue;
            (m[d] ??= []).push(e.fullName || 'Unnamed');
        }
        for (const k in m)
            m[k].sort((a, b) => a.localeCompare(b));
        return m;
    }, [employees]);
    const columns = useMemo(() => [
        { accessorKey: 'departmentName', header: 'Department', cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> },
        { id: 'count', header: 'Employees', accessorFn: (r) => byDept[r.id]?.length ?? 0,
            cell: ({ getValue }) => <span className="num">{getValue()}</span> },
        { id: 'members', header: 'Members', accessorFn: (r) => (byDept[r.id] ?? []).join(', '),
            cell: ({ getValue }) => (<span className="block max-w-sm truncate text-muted-foreground" title={getValue()}>{getValue() || '—'}</span>) },
        { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => (<span className="block max-w-md truncate text-muted-foreground">{getValue() || '—'}</span>) },
    ], [byDept]);
    return <CrudPage table="departments" title="Departments" singular="Department" description="Organize employees by team or branch." columns={columns} fields={fields}/>;
}
