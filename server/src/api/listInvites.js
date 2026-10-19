import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Lists pending user invites (admins only)',
    inputSchema: z.object({}),
    outputSchema: z.object({ invites: z.array(z.object({ id: z.string(), email: z.string(), role: z.string() })) }),
    execute: withLog('listInvites', async ({ context }) => {
        await requireAdmin(context.user, 'read');
        const { records } = await zite.appInvites.findAll({ limit: 500 });
        return { invites: records.map((r) => ({ id: r.id, email: r.email ?? '', role: r.role ?? 'Viewer' })) };
    }),
});
