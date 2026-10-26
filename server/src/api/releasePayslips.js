import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { db, rpc } from '../lib/supabase.js';
import { applyDeductions } from '../lib/deductions.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Releases draft payslips and deducts their cash advances and loans from balances',
    inputSchema: z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
    outputSchema: z.object({ released: z.number() }),
    execute: withLog('releasePayslips', async ({ input, context }) => {
        await requireAdmin(context.user);
        // The production path updates the payslip and every deduction ledger in one
        // PostgreSQL transaction. Keep the memory-backed local demo usable.
        if (process.env.NODE_ENV === 'production') {
            const released = await rpc('release_payroll_payslips', {
                p_ids: input.ids,
                p_actor: context.user.email ?? 'payroll-system',
            });
            return { released: Number(released ?? 0) };
        }
        let released = 0;
        for (const id of input.ids) {
            const slip = await db.payslips.findOne({ id });
            if (!slip || slip.status === 'Released')
                continue;
            await db.payslips.update({ id, record: { status: 'Released' } });
            await applyDeductions(slip.deductionDetails, -1, id);
            released++;
        }
        return { released };
    }),
});
