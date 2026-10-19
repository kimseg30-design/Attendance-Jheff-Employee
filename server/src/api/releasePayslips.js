import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { db } from '../lib/supabase.js';
import { applyDeductions } from '../lib/deductions.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Releases draft payslips and deducts their cash advances and loans from balances',
    inputSchema: z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
    outputSchema: z.object({ released: z.number() }),
    execute: withLog('releasePayslips', async ({ input, context }) => {
        await requireAdmin(context.user);
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
