import { z } from 'zod';
import { createEndpoint, ZiteError } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
const permissionSchema = z.enum(['attendance', 'cashAdvances']);
export default createEndpoint({
    authenticated: true,
    description: 'Sets a user role and Editor module permissions (admins only)',
    inputSchema: z.object({
        userId: z.string(),
        email: z.string(),
        role: z.enum(['Admin', 'Viewer', 'Editor', 'None']),
        permissions: z.array(permissionSchema).optional(),
    }),
    outputSchema: z.object({ success: z.boolean() }),
    execute: withLog('setUserRole', async ({ input, context }) => {
        await requireAdmin(context.user);
        if (input.role !== 'Admin') {
            const admins = await zite.userRoles.findAll({ filters: { role: 'Admin' }, limit: 2 });
            if (admins.records.length <= 1 && admins.records.some((a) => (Array.isArray(a.user) ? a.user[0] : a.user) === input.userId)) {
                throw new ZiteError({ code: 'BAD_REQUEST', message: 'Cannot demote last admin', userFacingMessage: 'There must be at least one admin.' });
            }
        }
        if (input.role === 'None') {
            const row = await zite.userRoles.findOne({ filters: { user: input.userId } });
            if (row)
                await zite.userRoles.delete({ id: row.id });
        }
        else {
            const permissions = input.role === 'Editor' ? [...new Set(input.permissions ?? [])] : [];
            const storedRole = input.role === 'Editor' ? `Editor|${permissions.join(',')}` : input.role;
            await zite.userRoles.bulkCreate({ records: [{ label: input.email, user: input.userId, role: storedRole }], matchOn: ['user'] });
        }
        return { success: true };
    }),
});
