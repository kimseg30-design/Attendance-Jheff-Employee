import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
function parseRole(raw) {
    const [base, encoded = ''] = String(raw ?? 'None').split('|', 2);
    const role = (base === 'Admin' || base === 'Viewer' || base === 'Editor' ? base : 'None');
    const permissions = encoded.split(',').filter((p) => p === 'attendance' || p === 'cashAdvances');
    return { role, permissions: role === 'Editor' ? [...new Set(permissions)] : [] };
}
export default createEndpoint({
    authenticated: true,
    description: 'Lists app users, roles, and module permissions (admins only)',
    inputSchema: z.object({}),
    outputSchema: z.object({ users: z.array(z.object({
            id: z.string(), name: z.string(), email: z.string(),
            role: z.enum(['Admin', 'Viewer', 'Editor', 'None']),
            permissions: z.array(z.enum(['attendance', 'cashAdvances'])),
        })) }),
    execute: withLog('listUsers', async ({ context }) => {
        await requireAdmin(context.user, 'read');
        const [users, roles] = await Promise.all([
            zite.auth.findAllUsers({ appIds: ['cfalkekpn2'], sort: [{ field: 'email', direction: 'asc' }], limit: 500 }),
            zite.userRoles.findAll({ limit: 2000 }),
        ]);

        const roleOfId = new Map(roles.records.map((r) => [Array.isArray(r.user) ? r.user[0] : r.user, parseRole(r.role)]));
        const roleOfEmail = new Map(roles.records.filter((r) => r.label).map((r) => [r.label.trim().toLowerCase(), parseRole(r.role)]));

        const allUsers = [...users.records];
        for (const r of roles.records) {
            const roleEmail = (r.label || '').trim().toLowerCase();
            const roleUserId = Array.isArray(r.user) ? r.user[0] : r.user;
            if (!allUsers.some((u) => u.id === roleUserId || (roleEmail && u.email?.toLowerCase() === roleEmail))) {
                allUsers.push({
                    id: roleUserId || `usr_${roleEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    name: roleEmail ? roleEmail.split('@')[0] : 'User',
                    email: roleEmail || 'user@example.com',
                });
            }
        }

        return {
            users: allUsers.map((u) => {
                const access = roleOfId.get(u.id) ?? roleOfEmail.get(u.email?.trim().toLowerCase()) ?? { role: 'None', permissions: [] };
                return { id: u.id, name: u.name || u.email, email: u.email, role: access.role, permissions: access.permissions };
            }),
        };
    }),
});
