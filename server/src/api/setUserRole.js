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
        const email = input.email.trim().toLowerCase();

        // Protect primary admin accounts from being demoted
        const isPrimaryAdmin = input.userId === 'usr_admin' || email === 'kimsegarra410@gmail.com' || (context.user && (input.userId === context.user.id || email === context.user.email?.toLowerCase()));
        if (isPrimaryAdmin && input.role !== 'Admin') {
            throw new ZiteError({
                code: 'BAD_REQUEST',
                message: 'Cannot demote primary administrator',
                userFacingMessage: 'The primary system admin account cannot be demoted. To test how the application behaves for other roles, use the Role Simulator in the top navigation.'
            });
        }

        if (input.role !== 'Admin') {
            const admins = await zite.userRoles.findAll({ filters: { role: 'Admin' }, limit: 5 });
            const isUserAdmin = admins.records.some((a) => {
                const aUser = Array.isArray(a.user) ? a.user[0] : a.user;
                return aUser === input.userId || (a.label && a.label.toLowerCase() === email);
            });
            if (admins.records.length <= 1 && isUserAdmin) {
                throw new ZiteError({ code: 'BAD_REQUEST', message: 'Cannot demote last admin', userFacingMessage: 'There must be at least one admin.' });
            }
        }
        if (input.role === 'None') {
            const row = (await zite.userRoles.findOne({ filters: { user: input.userId } }))
                     || (await zite.userRoles.findOne({ filters: { label: email } }));
            if (row) {
                await zite.userRoles.delete({ id: row.id });
            }
        }
        else {
            const permissions = input.role === 'Editor' ? [...new Set(input.permissions ?? [])] : [];
            const storedRole = input.role === 'Editor' ? `Editor|${permissions.join(',')}` : input.role;
            await zite.userRoles.bulkCreate({
                records: [{ label: email, user: input.userId, role: storedRole }],
                matchOn: ['user'],
            });
        }
        return { success: true };
    }),
});
