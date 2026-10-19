import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireMember } from '../lib/roles.js';
import { sf } from '../lib/sf.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Lists the Sinking Fund audit trail, newest first',
    inputSchema: z.object({}),
    outputSchema: z.object({ entries: z.array(z.record(z.any())) }),
    execute: withLog('sfGetAudit', async ({ context }) => {
        await requireMember(context.user);
        return { entries: await sf.list('auditLog', 2000) };
    }),
});
