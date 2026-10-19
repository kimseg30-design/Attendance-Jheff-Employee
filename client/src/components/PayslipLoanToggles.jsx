import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setPayslipDeduction } from '@/zite/api';
import { Switch } from '@/shared/ui/switch';
import { peso } from '../utils/format';

// Lets admins skip an active loan or cash advance deduction on a draft payslip before release.
export default function PayslipLoanToggles({ slip, onChange }) {
    const qc = useQueryClient();
    const [busy, setBusy] = useState(null);
    let details = [];
    try {
        details = JSON.parse(String(slip.deductionDetails || '[]'));
    }
    catch { /* empty */ }
    const loans = details.filter((d) => d.source !== 'sinkingContribution');
    if (!loans.length)
        return null;
    const toggle = async (d, include) => {
        const key = `${d.source}-${d.id}`;
        setBusy(key);
        try {
            const r = await setPayslipDeduction({ payslipId: String(slip.id), detailId: d.id, source: d.source, include });
            onChange(r.slip);
            qc.invalidateQueries({ queryKey: ['records'] });
            toast.success(include ? 'Loan deduction included' : 'Loan deduction skipped for this payslip');
        }
        catch (e) {
            toast.error(e.message || 'Could not update deduction');
        }
        finally {
            setBusy(null);
        }
    };
    return (
        <div className="rounded-xl border p-3.5 print:hidden bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <span>Active Member Loan Deductions</span>
                <span className="text-[11px] font-normal normal-case text-muted-foreground">Adjust before release</span>
            </div>
            <div className="space-y-2">
                {loans.map((d) => {
                    const key = `${d.source}-${d.id}`;
                    return (
                        <div key={key} className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-lg bg-card border shadow-xs">
                            <div>
                                <span className={`font-semibold block ${d.skipped ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {d.label ?? (d.source === 'sinkingFund' ? 'Sinking Fund loan' : 'Loan / cash advance')}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="num font-bold text-sm text-primary">{peso(d.amount)}</span>
                                <Switch checked={!d.skipped} disabled={busy === key} onCheckedChange={(v) => toggle(d, v)} />
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-muted-foreground">Turn off to skip a loan deduction for this cutoff. The loan balance stays unchanged for skipped items.</p>
        </div>
    );
}
