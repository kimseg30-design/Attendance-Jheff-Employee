import { useCallback, useMemo } from 'react';
import CrudPage from '../components/CrudPage';
import StatusBadge from '../components/StatusBadge';
import { useNameMap } from '../services/records';
import { fmtDate, firstId, peso } from '../utils/format';
const LOAN_TYPES = ['SSS Loan', 'Pag-IBIG Loan', 'Company Loan'];
export default function CashAdvancesPage({ mode = 'cash' }) {
    const emps = useNameMap('employees');
    const isLoans = mode === 'loans';
    const filter = useCallback((r) => (isLoans ? r.type !== 'Cash Advance' : r.type === 'Cash Advance'), [isLoans]);
    const columns = useMemo(() => [
        { id: 'emp', header: 'Employee', accessorFn: (r) => emps.map[firstId(r.employee) ?? ''] ?? '—', cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> },
        { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
        { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => <span className="block max-w-[200px] truncate text-muted-foreground">{getValue() || '—'}</span> },
        { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => <span className="num">{peso(getValue())}</span> },
        { accessorKey: 'deductionPerCutoff', header: 'Per Cutoff', cell: ({ getValue }) => <span className="num">{peso(getValue())}</span> },
        { accessorKey: 'balance', header: 'Balance', cell: ({ row }) => {
                const pct = row.original.amount ? 1 - (row.original.balance ?? 0) / row.original.amount : 0;
                return (<div className="w-32">
          <div className="num font-semibold">{peso(row.original.balance)}</div>
          <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct * 100)}%` }}/></div>
        </div>);
            } },
        { accessorKey: 'dateGranted', header: 'Granted', cell: ({ getValue }) => fmtDate(getValue()) },
        { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge value={getValue()}/> },
    ], [emps.map]);
    const fields = useMemo(() => [
        { key: 'employee', label: 'Employee', type: 'link', required: true, linkOptions: emps.list.map((e) => ({ id: e.id, name: e.fullName })) },
        isLoans
            ? { key: 'type', label: 'Loan Type', type: 'select', required: true, options: LOAN_TYPES }
            : { key: 'type', label: 'Type', type: 'select', required: true, options: ['Cash Advance'], defaultValue: 'Cash Advance' },
        { key: 'amount', label: 'Amount (₱)', type: 'number', required: true },
        { key: 'deductionPerCutoff', label: 'Deduction per Cutoff (₱)', type: 'number', required: true },
        { key: 'balance', label: 'Balance (defaults to amount)', type: 'number' },
        { key: 'dateGranted', label: 'Date Granted', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Paid'], defaultValue: 'Active', required: true },
        { key: 'description', label: 'Description', type: 'text' },
    ], [emps.list, isLoans]);
    const beforeSave = useCallback((v) => ({ ...v, balance: v.balance ?? v.amount }), []);
    return <CrudPage key={mode} table="cashAdvances" title={isLoans ? 'Loans' : 'Cash Advances'} singular={isLoans ? 'Loan' : 'Cash Advance'} description={isLoans ? 'SSS, Pag-IBIG and company loans. Balances reduce only when a payslip is released.' : 'Cash advances. Balances reduce only when a payslip is released.'} columns={columns} fields={fields} beforeSave={beforeSave} filter={filter}/>;
}
