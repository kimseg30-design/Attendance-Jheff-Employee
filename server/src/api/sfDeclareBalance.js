import { z } from 'zod';
import { createEndpoint, ZiteError } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { sf } from '../lib/sf.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: "Officially declares and resets a borrower's baseline principal balance (admins only)",
    inputSchema: z.object({ loanId: z.string(), principal: z.number().min(0), declaredAt: z.string(), previousPrincipal: z.number(), reason: z.string().min(1) }),
    outputSchema: z.object({ success: z.boolean() }),
    execute: withLog('sfDeclareBalance', async ({ input, context }) => {
        await requireAdmin(context.user);
        const loan = await sf.get('loans', input.loanId);
        if (!loan)
            throw new ZiteError({ code: 'NOT_FOUND', message: 'Loan not found', userFacingMessage: 'Loan not found.' });
        await sf.create('balanceDeclarations', {
            loanId: input.loanId, previousPrincipal: input.previousPrincipal, declaredPrincipal: input.principal,
            declaredAt: input.declaredAt, reason: input.reason, declaredBy: context.user.email,
        });
        await sf.update('loans', input.loanId, { declaredPrincipal: input.principal, declaredAt: input.declaredAt });
        await sf.audit('Balance declared', 'loans', input.loanId, `${loan.borrowerName}: ₱${input.previousPrincipal.toFixed(2)} → ₱${input.principal.toFixed(2)} as of ${input.declaredAt}. ${input.reason}`, context.user.email);
        return { success: true };
    }),
});
