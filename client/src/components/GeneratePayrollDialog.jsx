import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Checkbox } from '@/shared/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Loader2 } from 'lucide-react';
import { addDays, endOfMonth, format, startOfWeek, subWeeks } from 'date-fns';
import { toast } from 'sonner';
import { generatePayroll } from '@/zite/api';
import { toISODate } from '../utils/format';
const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});
// Monday–Sunday weeks, most recent first
const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
    const end = addDays(start, 6);
    return { value: toISODate(start), start, end, label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}` };
});
function Field({ label, children }) {
    return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
export default function GeneratePayrollDialog({ open, onOpenChange }) {
    const [freq, setFreq] = useState('semi-monthly');
    const [month, setMonth] = useState(months[0].value);
    const [cutoff, setCutoff] = useState(new Date().getDate() <= 15 ? '1' : '2');
    const [week, setWeek] = useState(weeks[0].value);
    const [benefits, setBenefits] = useState({ sss: true, philHealth: true, pagIbig: true, tax: true });
    const qc = useQueryClient();
    let start, end, label;
    if (freq === 'weekly') {
        const w = weeks.find((x) => x.value === week) ?? weeks[0];
        start = w.start;
        end = w.end;
        label = `Week of ${w.label}`;
    }
    else {
        const [y, m] = month.split('-').map(Number);
        start = new Date(y, m - 1, cutoff === '1' ? 1 : 16);
        end = cutoff === '1' ? new Date(y, m - 1, 15) : endOfMonth(start);
        label = `${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`;
    }
    const run = useMutation({
        mutationFn: () => generatePayroll({ periodStart: toISODate(start), periodEnd: toISODate(end), periodLabel: label, frequency: freq, benefits }),
        onSuccess: async (r) => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['records', 'payslips'] }),
                qc.invalidateQueries({ queryKey: ['dashboard'] }),
            ]);
            toast.success(`Generated ${r.created} payslip${r.created === 1 ? '' : 's'}${r.skipped ? ` · ${r.skipped} already existed` : ''}`);
            onOpenChange(false);
        },
        onError: (e) => toast.error(e.message),
    });
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run payroll</DialogTitle>
          <DialogDescription>Computes earnings from attendance within the selected date range, including optional overtime and other benefits. Weekly Sinking Fund contributions are linked to this payroll range and shown separately on the payslip.</DialogDescription>
        </DialogHeader>
        <Tabs value={freq} onValueChange={(v) => setFreq(v)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="semi-monthly">Semi-monthly</TabsTrigger>
            <TabsTrigger value="weekly">Weekly (Mon–Sun)</TabsTrigger>
          </TabsList>
        </Tabs>
        {freq === 'weekly' ? (<Field label="Week">
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{weeks.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>) : (<div className="grid grid-cols-2 gap-4">
            <Field label="Month">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{months.map((mo) => <SelectItem key={mo.value} value={mo.value}>{mo.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Cutoff">
              <Select value={cutoff} onValueChange={setCutoff}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1st (1–15)</SelectItem><SelectItem value="2">2nd (16–end)</SelectItem></SelectContent>
              </Select>
            </Field>
          </div>)}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Deductions to apply</Label>
          <div className="grid grid-cols-2 gap-2">
            {[['sss', 'SSS'], ['philHealth', 'PhilHealth'], ['pagIbig', 'Pag-IBIG'], ['tax', 'Withholding tax']].map(([k, l]) => (<label key={k} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted/50">
                <Checkbox checked={benefits[k]} onCheckedChange={(v) => setBenefits((b) => ({ ...b, [k]: !!v }))}/>{l}
              </label>))}
          </div>
          <p className="text-xs text-muted-foreground">Untick any your company isn't registered for yet — it will be ₱0 on payslips.</p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          Period: <span className="font-semibold">{label}</span>
          {freq === 'weekly' && <p className="mt-1 text-xs text-muted-foreground">Contributions are split across 4 weeks; weekly BIR tax table applies.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Generate payslips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
