import { db } from './supabase';
import { sf } from './sf';
/** Reverses contribution ledger rows for a deleted draft payslip without changing other deductions. */
export async function removeGeneratedContributions(detailsJson, payslipId) {
    let details = [];
    try {
        details = JSON.parse(detailsJson || '[]');
    }
    catch {
        return;
    }
    if (!details.some((d) => d.source === 'sinkingContribution'))
        return;
    const marker = `PAYSLIP-${payslipId}-`;
    const contributions = await sf.list('contributions');
    for (const c of contributions.filter((row) => String(row.referenceNo ?? '').startsWith(marker))) {
        await sf.remove('contributions', String(c.id));
    }
}
/** Applies (sign = -1) or reverses (sign = +1) payslip deductions. Sinking Fund loan repayments are written to the SF payment ledger. */
export async function applyDeductions(detailsJson, sign, payslipId) {
    let details = [];
    try {
        details = JSON.parse(detailsJson || '[]');
    }
    catch {
        return;
    }
    details = details.filter((d) => !d.skipped);
    const sfDetails = details.filter((d) => d.source === 'sinkingFund');
    const contributionDetails = details.filter((d) => d.source === 'sinkingContribution');
    const advanceDetails = details.filter((d) => d.source !== 'sinkingFund' && d.source !== 'sinkingContribution');
    await Promise.all(advanceDetails.map(async (d) => {
        const item = await db.cashAdvances.findOne({ id: d.id });
        if (!item)
            return;
        const balance = Math.max(0, Math.round(((item.balance ?? 0) + sign * d.amount) * 100) / 100);
        await db.cashAdvances.update({ id: d.id, record: { balance, status: balance <= 0 ? 'Paid' : 'Active' } });
    }));
    if (!payslipId || (!sfDetails.length && !contributionDetails.length))
        return;
    const marker = `PAYSLIP-${payslipId}-`;
    if (sfDetails.length) {
        const payments = await sf.list('payments');
        if (sign === -1) {
            for (const d of sfDetails) {
                const referenceNo = `${marker}${d.id}`;
                if (payments.some((p) => p.referenceNo === referenceNo))
                    continue;
                const loan = await sf.get('loans', d.id);
                if (!loan)
                    continue;
                await sf.create('payments', {
                    loanId: d.id,
                    paidOn: d.paidOn ?? new Date().toISOString().slice(0, 10),
                    amount: Math.round(Number(d.amount) * 100) / 100,
                    lateFee: 0,
                    referenceNo,
                    notes: `Payroll deduction from payslip ${payslipId}`,
                    prepayInterest: false,
                });
                await sf.audit('Payroll loan deduction recorded', 'loans', d.id, `Payroll payslip ${payslipId}: ₱${Number(d.amount).toFixed(2)}`, 'payroll-system');
            }
        }
        else {
            for (const p of payments.filter((p) => String(p.referenceNo ?? '').startsWith(marker))) {
                await sf.remove('payments', String(p.id));
                await sf.audit('Payroll loan deduction reversed', 'loans', String(p.loanId), `Deleted released payslip ${payslipId}; reversed ₱${Number(p.amount ?? 0).toFixed(2)} payroll repayment`, 'payroll-system');
            }
        }
    }
    // A released weekly base contribution becomes an actual contribution record.
    // Removing a released payslip reverses only contribution records created by that payslip.
    const contributions = await sf.list('contributions');
    if (sign === -1) {
        for (const d of contributionDetails) {
            const referenceNo = `${marker}${d.id}`;
            const existing = contributions.find((c) => c.referenceNo === referenceNo);
            if (existing) {
                await sf.update('contributions', String(existing.id), {
                    notes: `Weekly base contribution deducted from released payslip ${payslipId}; payroll range ${d.periodStart ?? '—'} to ${d.periodEnd ?? d.paidOn ?? '—'}`,
                });
                continue;
            }
            await sf.create('contributions', {
                memberId: d.id,
                amount: Math.round(Number(d.amount) * 100) / 100,
                contributedOn: d.paidOn ?? new Date().toISOString().slice(0, 10),
                payrollPeriodStart: d.periodStart ?? null,
                payrollPeriodEnd: d.periodEnd ?? d.paidOn ?? null,
                referenceNo,
                notes: `Weekly base contribution deducted from payslip ${payslipId}; payroll range ${d.periodStart ?? '—'} to ${d.periodEnd ?? d.paidOn ?? '—'}`,
            });
            await sf.audit('Payroll sinking contribution recorded', 'contributions', d.id, `Payslip ${payslipId}: ₱${Number(d.amount).toFixed(2)}`, 'payroll-system');
        }
    }
    else {
        for (const c of contributions.filter((c) => String(c.referenceNo ?? '').startsWith(marker))) {
            await sf.remove('contributions', String(c.id));
            await sf.audit('Payroll sinking contribution reversed', 'contributions', String(c.memberId), `Deleted released payslip ${payslipId}; reversed ₱${Number(c.amount ?? 0).toFixed(2)} contribution`, 'payroll-system');
        }
    }
}
