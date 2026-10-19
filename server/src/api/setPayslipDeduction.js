import { z } from 'zod';
import { createEndpoint, ZiteError } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { db } from '../lib/supabase.js';
import { withLog } from '../lib/guard.js';
const r2 = (n) => Math.round(n * 100) / 100;
export default createEndpoint({
    authenticated: true,
    description: 'Includes or skips a loan / cash advance deduction on a draft payslip',
    inputSchema: z.object({ payslipId: z.string(), detailId: z.string(), source: z.string().optional(), include: z.boolean() }),
    outputSchema: z.object({ slip: z.record(z.any()) }),
    execute: withLog('setPayslipDeduction', async ({ input, context }) => {
        await requireAdmin(context.user);
        const slip = await db.payslips.findOne({ id: input.payslipId });
        if (!slip)
            throw new ZiteError({ code: 'NOT_FOUND', message: 'Payslip not found', userFacingMessage: 'Payslip not found.' });
        if (slip.status === 'Released')
            throw new ZiteError({ code: 'BAD_REQUEST', message: 'Already released', userFacingMessage: 'This payslip is already released and can no longer be changed.' });
        let details = [];
        try {
            details = JSON.parse(slip.deductionDetails || '[]');
        }
        catch { /* empty */ }
        const d = details.find((x) => x.id === input.detailId && (x.source ?? 'cashAdvance') === (input.source ?? 'cashAdvance'));
        if (!d || d.source === 'sinkingContribution')
            throw new ZiteError({ code: 'BAD_REQUEST', message: 'Deduction not found', userFacingMessage: 'Deduction not found on this payslip.' });
        if (!d.skipped === input.include)
            return { slip };
        d.skipped = !input.include;
        const delta = input.include ? d.amount : -d.amount;
        // Cash advances of type "Cash Advance" go to the cash-advance line; everything else is a loan.
        let isCash = false;
        if (d.source !== 'sinkingFund') {
            const ca = await db.cashAdvances.findOne({ id: d.id });
            isCash = ca?.type === 'Cash Advance';
        }
        const record = {
            deductionDetails: JSON.stringify(details),
            loanDeductions: r2((Number(slip.loanDeductions) || 0) + (isCash ? 0 : delta)),
            cashAdvanceDeduction: r2((Number(slip.cashAdvanceDeduction) || 0) + (isCash ? delta : 0)),
            netPay: r2((Number(slip.netPay) || 0) - delta),
        };
        await db.payslips.update({ id: slip.id, record });
        return { slip: { ...slip, ...record } };
    }),
});
