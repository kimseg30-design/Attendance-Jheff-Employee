import { zite } from '../zite/db.js';
import { ZiteError } from '../zite/backend.js';
import { logFailure, throttle } from './guard.js';
function decodeRole(raw) {
    const value = String(raw ?? 'None');
    const [base, encoded = ''] = value.split('|', 2);
    const role = base === 'Admin' || base === 'Viewer' || base === 'Editor' ? base : 'None';
    const valid = encoded.split(',').filter((p) => p === 'attendance' || p === 'cashAdvances');
    return { role, permissions: role === 'Editor' ? [...new Set(valid)] : [] };
}
// Accounts that are guaranteed Admin access
const DEFAULT_ADMIN_EMAILS = new Set(['kimsegarra410@gmail.com', 'kimsegarra4@gmail.com', 'kimsegarra516@gmail.com']);
export function isDefaultAdmin(user) {
    if (!user) return false;
    if (user.id === 'usr_admin' || user.id === 'usr_admin_alt' || user.id === 'usr_admin_orig') return true;
    const email = (user.email || '').trim().toLowerCase();
    return Boolean(email && DEFAULT_ADMIN_EMAILS.has(email));
}
export async function getRole(user) {
    if (!user) return 'None';
    if (user.simulatedRole) {
        return decodeRole(user.simulatedRole).role;
    }

    // 1. Primary system administrators are guaranteed Admin to prevent lockouts
    if (isDefaultAdmin(user)) {
        return 'Admin';
    }

    const email = (user.email || '').trim().toLowerCase();

    // 2. Explicit assigned role stored in DB (by user ID or by email label)
    const mine = (await zite.userRoles.findOne({ filters: { user: user.id } }))
              || (email ? await zite.userRoles.findOne({ filters: { label: email } }) : null);
    if (mine?.role) {
        return decodeRole(mine.role).role;
    }

    // 3. First sign-in of an invited user: turn the invite into their role
    if (email) {
        const invite = await zite.appInvites.findOne({ filters: { email } });
        if (invite?.role) {
            await zite.userRoles.bulkCreate({ records: [{ label: email, user: user.id, role: invite.role }], matchOn: ['user'] });
            await zite.appInvites.delete({ id: invite.id });
            return decodeRole(invite.role).role;
        }
    }

    // 4. Auto-grant Admin to the initial user if table is empty
    const allRoles = await zite.userRoles.findAll({ limit: 5 });
    if (!allRoles.records || allRoles.records.length === 0) {
        await zite.userRoles.bulkCreate({ records: [{ label: email || 'admin@example.com', user: user.id, role: 'Admin' }], matchOn: ['user'] });
        return 'Admin';
    }

    return 'None';
}
export async function getPermissions(user) {
    if (!user) return [];
    if (user.simulatedRole) {
        return decodeRole(user.simulatedRole).permissions;
    }
    const role = await getRole(user);
    if (role !== 'Editor') return [];
    const email = (user.email || '').trim().toLowerCase();
    const mine = (await zite.userRoles.findOne({ filters: { user: user.id } }))
              || (email ? await zite.userRoles.findOne({ filters: { label: email } }) : null);
    return decodeRole(mine?.role).permissions;
}
function noSession() {
    throw new ZiteError({ code: 'UNAUTHORIZED', message: 'No session', userFacingMessage: 'Please sign in.' });
}
async function forbid(user, message, userFacingMessage) {
    await logFailure('Permission denied', 'FORBIDDEN', user.email, message);
    throw new ZiteError({ code: 'FORBIDDEN', message, userFacingMessage });
}
async function require(user, allowed, denied, kind) {
    if (!user)
        noSession();
    await throttle(user, kind);
    const role = await getRole(user);
    if (!allowed.includes(role))
        await forbid(user, `User ${user.id} has role ${role}`, denied);
}
export const requireAdmin = (user, kind = 'write') => require(user, ['Admin'], 'Only an admin can make this change.', kind);
export const requireMember = (user, kind = 'read') => require(user, ['Admin', 'Viewer'], "You don't have access to this part of the app. Ask an admin to approve your account.", kind);
export async function requireTableAccess(user, table, action = 'read') {
    if (!user)
        noSession();
    await throttle(user, action);
    const role = await getRole(user);
    if (role === 'Admin' || (role === 'Viewer' && action === 'read'))
        return;
    const norm = table === 'cash_advances' ? 'cashAdvances' : table;
    if (role === 'Editor') {
        const permissions = await getPermissions(user);
        const allowedTable = norm === 'attendance' ? permissions.includes('attendance')
            : norm === 'cashAdvances' ? permissions.includes('cashAdvances')
                : norm === 'employees' && action === 'read' && permissions.some((p) => p === 'attendance' || p === 'cashAdvances');
        if (allowedTable)
            return;
    }
    await forbid(user, `User ${user.id} lacks ${action} access to ${table}`, 'You do not have permission for this section. Ask an admin to update your access.');
}
export async function requireEditorModule(user, permission, kind = 'read') {
    if (!user)
        noSession();
    await throttle(user, kind);
    const role = await getRole(user);
    if (role === 'Admin' || role === 'Viewer')
        return;
    if (role === 'Editor' && (await getPermissions(user)).includes(permission))
        return;
    await forbid(user, `User ${user.id} lacks ${permission} access`, 'You do not have permission for this section. Ask an admin to update your access.');
}
