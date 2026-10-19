import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Cancels a pending user invite (admins only)',
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ success: z.boolean() }),
    execute: withLog('revokeInvite', async ({ input, context }) => {
        await requireAdmin(context.user);
        await zite.appInvites.delete({ id: input.id });
        return { success: true };
    }),
});
