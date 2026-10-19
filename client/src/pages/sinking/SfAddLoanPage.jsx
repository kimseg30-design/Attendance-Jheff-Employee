import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { DatePicker } from '@/shared/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import PageHeader from '../../components/PageHeader';
import { useSf, useSfSave } from '../../services/sf';
import { useNameMap } from '../../services/records';
import { firstDueFor, phToday, PER_MONTH } from '../../lib/loanCalc';
import { peso, fmtDate, toISODate } from '../../utils/format';
const schema = z.object({
    borrowerName: z.string().trim().min(2, 'Enter the borrower name'),
    contactNo: z.string().optional(), address: z.string().optional(), purpose: z.string().optional(),
    loanGroup: z.enum(['1st Group', '2nd Group']), loanType: z.enum(['New Loan', 'Reloan']),
    principal: z.coerce.number().positive('Must be more than 0'),
    monthlyRate: z.coerce.number().min(0).max(100),
    termMonths: z.coerce.number().int().min(1, 'At least 1 month').max(120),
    frequency: z.enum(['Weekly', 'Biweekly', 'Monthly']),
    penaltyRate: z.coerce.number().min(0).max(100),
    graceDays: z.coerce.number().int().min(0).max(60),
    startDate: z.string().min(10, 'Pick a date'),
});
function Field({ label, error, children }) {
    return <div className="space-y-1.5"><Label>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}
function Pick({ value, onChange, options }) {
    return <Select value={value} onValueChange={(v) => onChange(v)}><SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>;
}
export default function SfAddLoanPage() {
    const { settings, loans } = useSf();
    const employees = useNameMap('employees');
    const [employeePick, setEmployeePick] = useState('none');
    const save = useSfSave();
    const nav = useNavigate();
    const f = useForm({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: {
            borrowerName: '', loanGroup: '1st Group', loanType: 'New Loan', principal: 0, monthlyRate: 5, termMonths: 1,
            frequency: 'Monthly', penaltyRate: 2, graceDays: 3, startDate: phToday(),
        } });
    useEffect(() => {
        if (settings.defaultMonthlyRate != null && !f.formState.isDirty) {
            f.setValue('monthlyRate', Number(settings.defaultMonthlyRate));
            f.setValue('penaltyRate', Number(settings.defaultPenaltyRate ?? 2));
            f.setValue('graceDays', Number(settings.defaultGraceDays ?? 3));
        }
    }, [settings, f]);
    const v = f.watch();
    const name = v.borrowerName?.trim().toLowerCase();
    useEffect(() => {
        if (name && loans.some((l) => String(l.borrowerName).trim().toLowerCase() === name))
            f.setValue('loanType', 'Reloan');
    }, [name, loans, f]);
    const preview = useMemo(() => {
        const p = Number(v.principal) || 0, mi = p * (Number(v.monthlyRate) || 0) / 100, t = Number(v.termMonths) || 1;
        const n = t * PER_MONTH[v.frequency];
        return { mi, total: p + mi * t, inst: (p + mi * t) / n, n, firstDue: v.startDate ? firstDueFor(v.startDate, v.frequency) : '' };
    }, [v.principal, v.monthlyRate, v.termMonths, v.frequency, v.startDate]);
    const submit = f.handleSubmit((data) => save.mutate({ table: 'loans', record: { ...data, employeeId: employeePick === 'none' ? null : employeePick, firstDueDate: firstDueFor(data.startDate, data.frequency), earlySettlement: false } }, {
        onSuccess: (r) => { toast.success('Loan created'); nav(`/sinking-fund/loans/${r.id}`); },
    }));
    const e = f.formState.errors;
    return (<div>
      <PageHeader title="Add Loan" description="Set up a new loan. The first due date is set automatically from the repayment frequency."/>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-xl border bg-card p-5 shadow-sm">
          <div><h2 className="mb-3 font-semibold">Borrower</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link to employee (optional)"><Select value={employeePick} onValueChange={(id) => { setEmployeePick(id); const emp = employees.list.find((x) => x.id === id); if (emp)
        f.setValue('borrowerName', String(emp.fullName ?? ''), { shouldValidate: true, shouldDirty: true }); }}><SelectTrigger><SelectValue placeholder="Select employee"/></SelectTrigger><SelectContent><SelectItem value="none">Manual borrower name</SelectItem>{employees.list.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Borrower name" error={e.borrowerName?.message}><Input {...f.register('borrowerName')}/></Field>
              <Field label="Contact no."><Input {...f.register('contactNo')}/></Field>
              <div className="sm:col-span-2"><Field label="Address"><Input {...f.register('address')}/></Field></div>
              <Field label="Loan group"><Controller control={f.control} name="loanGroup" render={({ field }) => <Pick value={field.value} onChange={field.onChange} options={['1st Group', '2nd Group']}/>}/></Field>
              <Field label="Loan type"><Controller control={f.control} name="loanType" render={({ field }) => <Pick value={field.value} onChange={field.onChange} options={['New Loan', 'Reloan']}/>}/></Field>
            </div></div>
          <div><h2 className="mb-3 font-semibold">Terms</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Principal (₱)" error={e.principal?.message}><Input type="number" step="0.01" {...f.register('principal')}/></Field>
              <Field label="Interest per month (%)" error={e.monthlyRate?.message}><Input type="number" step="0.01" {...f.register('monthlyRate')}/></Field>
              <Field label="Term (months)" error={e.termMonths?.message}><Input type="number" {...f.register('termMonths')}/></Field>
              <Field label="Repayment frequency"><Controller control={f.control} name="frequency" render={({ field }) => <Pick value={field.value} onChange={field.onChange} options={['Weekly', 'Biweekly', 'Monthly']}/>}/></Field>
              <Field label="Late penalty (%)" error={e.penaltyRate?.message}><Input type="number" step="0.01" {...f.register('penaltyRate')}/></Field>
              <Field label="Grace period (days)" error={e.graceDays?.message}><Input type="number" {...f.register('graceDays')}/></Field>
              <Field label="Release date" error={e.startDate?.message}><Controller control={f.control} name="startDate" render={({ field }) => <DatePicker value={field.value ? parseISO(field.value) : undefined} onChange={(d) => field.onChange(d ? toISODate(d) : '')}/>}/></Field>
              <div className="sm:col-span-2"><Field label="Purpose / notes"><Textarea rows={2} {...f.register('purpose')}/></Field></div>
            </div></div>
        </div>
        <div className="h-fit space-y-3 rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold">Summary</h2>
          {[['Monthly interest', peso(preview.mi)], ['Total payable', peso(preview.total)], [`${preview.n} × ${v.frequency.toLowerCase()} payment`, peso(preview.inst)], ['First due date', fmtDate(preview.firstDue)]].map(([l, x]) => (<div key={l} className="flex justify-between text-sm"><span className="text-muted-foreground">{l}</span><span className="num font-semibold">{x}</span></div>))}
          <Button type="submit" className="w-full" disabled={!f.formState.isValid || save.isPending}>{save.isPending ? 'Saving…' : 'Create loan'}</Button>
        </div>
      </form>
    </div>);
}
