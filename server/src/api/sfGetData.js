import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireMember } from '../lib/roles.js';
import { sf } from '../lib/sf.js';
import { withLog } from '../lib/guard.js';
const rows = z.array(z.record(z.any()));
export default createEndpoint({
    authenticated: true,
    description: 'Loads all Sinking Fund data (members, contributions, loans, payments, settings)',
    inputSchema: z.object({}),
    outputSchema: z.object({ members: rows, contributions: rows, loans: rows, payments: rows, declarations: rows, settings: z.record(z.any()).nullable() }),
    execute: withLog('sfGetData', async ({ context }) => {
        await requireMember(context.user);
        const [members, contributions, loans, payments, declarations, settings] = await Promise.all([
            sf.list('members'), sf.list('contributions'), sf.list('loans'), sf.list('payments'), sf.list('balanceDeclarations'), sf.get('settings', 1),
        ]);
        return { members, contributions, loans, payments, declarations, settings: settings ?? null };
    }),
});
