import { z } from 'zod';
import { createEndpoint, ZiteError } from '../zite/backend.js';
import { admin, zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Adds a user by email so they can sign in with the chosen role (admins only)',
    inputSchema: z.object({
        email: z.string().email(),
        role: z.enum(['Admin', 'Viewer', 'Editor']),
        permissions: z.array(z.enum(['attendance', 'cashAdvances'])).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), invited: z.boolean() }),
    execute: withLog('inviteUser', async ({ input, context }) => {
        await requireAdmin(context.user);
        const email = input.email.trim().toLowerCase();
        if (!z.string().email().safeParse(email).success) {
            throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid email', userFacingMessage: 'Please enter a valid email address.' });
        }
        const permissions = input.role === 'Editor' ? [...new Set(input.permissions ?? [])] : [];
        if (input.role === 'Editor' && !permissions.length) {
            throw new ZiteError({ code: 'BAD_REQUEST', message: 'Editor without modules', userFacingMessage: 'Pick at least one module for an Editor.' });
        }
        const role = input.role === 'Editor' ? `Editor|${permissions.join(',')}` : input.role;
        // Already has an account in this app → set role directly.
        const existing = await zite.auth.findAllUsers({ appIds: ['cfalkekpn2'], filters: { email }, limit: 1 });
        const user = existing.records[0];
        if (user) {
            await zite.userRoles.bulkCreate({ records: [{ label: email, user: user.id, role }], matchOn: ['user'] });
            return { success: true, invited: false };
        }
        if (!admin?.auth?.admin) {
            throw new ZiteError({ code: 'INTERNAL', message: 'Supabase Auth Admin API is not configured.', userFacingMessage: 'The server cannot send account invitations. Check its Supabase server key.' });
        }
        const redirectTo = `${(process.env.APP_BASE_URL || '').replace(/\/$/, '')}/auth/callback`;
        if (!redirectTo.startsWith('https://') && process.env.NODE_ENV === 'production') {
            throw new ZiteError({ code: 'INTERNAL', message: 'APP_BASE_URL must be configured with the production HTTPS origin.' });
        }
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (error) throw error;
        if (!data?.user?.id) throw new Error('Supabase did not return the invited user id.');
        await zite.userRoles.bulkCreate({ records: [{ label: email, user: data.user.id, role }], matchOn: ['user'] });
        return { success: true, invited: true };
    }),
});
