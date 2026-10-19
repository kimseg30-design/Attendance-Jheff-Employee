import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { sf } from '../lib/sf.js';
import { withLog } from '../lib/guard.js';
const TABLES = ['members', 'contributions', 'loans', 'payments'];
const LABEL = { members: 'Member', contributions: 'Contribution', loans: 'Loan', payments: 'Payment' };
export default createEndpoint({
    authenticated: true,
    description: 'Deletes a Sinking Fund record and records it in the audit log (admins only)',
    inputSchema: z.object({ table: z.enum(TABLES), id: z.string() }),
    outputSchema: z.object({ success: z.boolean() }),
    execute: withLog('sfDelete', async ({ input, context }) => {
        await requireAdmin(context.user);
        const before = await sf.get(input.table, input.id);
        if (input.table === 'loans') {
            const payments = await sf.list('payments');
            const loanPayments = payments.filter((p) => String(p.loanId) === input.id);
            for (const p of loanPayments) {
                await sf.remove('payments', String(p.id));
            }
        }
        await sf.remove(input.table, input.id);
        const name = before?.borrowerName ?? before?.fullName ?? '';
        const amount = before?.amount != null ? ` ₱${Number(before.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '';
        const date = before?.paidOn ?? before?.contributedOn ?? '';
        await sf.audit(`${LABEL[input.table]} deleted`, input.table, input.id, `${name}${amount} ${date}`.trim(), context.user.email);
        return { success: true };
    }),
});
