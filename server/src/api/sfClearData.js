import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { sf } from '../lib/sf.js';
import { withLog } from '../lib/guard.js';
const idOf = (row) => String(row.id);
const linked = (row, key, ids) => ids.has(String(row[key] ?? ''));
export default createEndpoint({
    authenticated: true,
    description: 'Admin-only deletion of selected Sinking Fund data with dependency cleanup and audit logging. Settings and audit history are preserved.',
    inputSchema: z.object({ target: z.enum(['loans', 'contributions', 'members', 'all']), confirmation: z.literal('DELETE') }),
    outputSchema: z.object({ success: z.boolean(), deletedCounts: z.record(z.number()), deleted: z.array(z.string()) }),
    execute: withLog('sfClearData', async ({ input, context }) => {
        await requireAdmin(context.user);
        const target = input.target;
        const counts = {};
        const removed = [];
        const removeRows = async (table, rows) => {
            for (const row of rows)
                await sf.remove(table, idOf(row));
            counts[table] = (counts[table] ?? 0) + rows.length;
            if (rows.length)
                removed.push(table);
        };
        const [members, contributions, loans, payments, declarations] = await Promise.all([
            sf.list('members'), sf.list('contributions'), sf.list('loans'), sf.list('payments'), sf.list('balanceDeclarations'),
        ]);
        if (target === 'loans' || target === 'all') {
            const loanIds = new Set(loans.map(idOf));
            await removeRows('payments', payments.filter((r) => linked(r, 'loanId', loanIds)));
            await removeRows('balanceDeclarations', declarations.filter((r) => linked(r, 'loanId', loanIds)));
            await removeRows('loans', loans);
        }
        if (target === 'contributions' || target === 'all')
            await removeRows('contributions', contributions);
        if (target === 'members') {
            const memberIds = new Set(members.map(idOf));
            const memberContributions = contributions.filter((r) => linked(r, 'memberId', memberIds));
            // Loans can be associated through an explicit member link, a linked employee,
            // or a legacy borrower-name match. Keep dependency cleanup aligned with those links.
            const employeeIds = new Set(members.map((m) => String(m.employeeId ?? '')).filter(Boolean));
            const memberNames = new Set(members.map((m) => String(m.fullName ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
            const memberLoans = loans.filter((r) => linked(r, 'memberId', memberIds) ||
                linked(r, 'employeeId', employeeIds) ||
                memberNames.has(String(r.borrowerName ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')));
            const memberLoanIds = new Set(memberLoans.map(idOf));
            await removeRows('payments', payments.filter((r) => linked(r, 'loanId', memberLoanIds)));
            await removeRows('balanceDeclarations', declarations.filter((r) => linked(r, 'loanId', memberLoanIds)));
            await removeRows('loans', memberLoans);
            await removeRows('contributions', memberContributions);
            await removeRows('members', members);
        }
        else if (target === 'all')
            await removeRows('members', members);
        await sf.audit('Bulk data deletion', 'data', target, 'Admin deleted Sinking Fund scope: ' + target + '. Counts: ' + JSON.stringify(counts) + '. Settings and audit history were preserved.', context.user.email);
        return { success: true, deletedCounts: counts, deleted: removed };
    }),
});
