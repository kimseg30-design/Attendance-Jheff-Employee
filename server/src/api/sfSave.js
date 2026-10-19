import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { sf } from '../lib/sf.js';
import { withLog } from '../lib/guard.js';
const TABLES = ['members', 'contributions', 'loans', 'payments', 'settings'];
const LABEL = { members: 'Member', contributions: 'Contribution', loans: 'Loan', payments: 'Payment', settings: 'Settings' };
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
function describe(table, r) {
    if (table === 'loans')
        return `${r.borrowerName} — ${peso(r.principal)} @ ${r.monthlyRate}%/mo, ${r.termMonths} mo, ${r.frequency}`;
    if (table === 'payments')
        return `${peso(r.amount)}${Number(r.lateFee) ? ` + late fee ${peso(r.lateFee)}` : ''} on ${r.paidOn}${r.referenceNo ? ` (ref ${r.referenceNo})` : ''}`;
    if (table === 'contributions')
        return `${peso(r.amount)} on ${r.contributedOn}`;
    if (table === 'members')
        return String(r.fullName ?? '');
    return 'Updated fund settings';
}
export default createEndpoint({
    authenticated: true,
    description: 'Creates or updates a Sinking Fund record and writes it to the audit log (admins only)',
    inputSchema: z.object({ table: z.enum(TABLES), id: z.string().max(100).optional(), record: z.record(z.any()).refine((value) => Object.keys(value).length <= 50 && JSON.stringify(value).length <= 50_000, { message: 'Record payload is too large.' }) }),
    outputSchema: z.object({ id: z.string() }),
    execute: withLog('sfSave', async ({ input, context }) => {
        await requireAdmin(context.user);
        const actor = context.user.email;
        if (input.table === 'settings') {
            await sf.update('settings', 1, input.record);
            await sf.audit('Settings updated', 'settings', '1', describe('settings', input.record), actor);
            return { id: '1' };
        }
        if (input.id) {
            const before = await sf.get(input.table, input.id);
            await sf.update(input.table, input.id, input.record);
            await sf.audit(`${LABEL[input.table]} updated`, input.table, input.id, describe(input.table, { ...before, ...input.record }), actor);
            return { id: input.id };
        }
        const created = await sf.create(input.table, input.record);
        const action = input.table === 'payments' ? 'Payment logged' : `${LABEL[input.table]} created`;
        let details = describe(input.table, created);
        if (input.table === 'payments') {
            const loan = await sf.get('loans', String(created.loanId));
            details = `${loan?.borrowerName ?? 'Loan'}: ${details}`;
        }
        await sf.audit(action, input.table, String(created.id), details, actor);
        return { id: String(created.id) };
    }),
});
