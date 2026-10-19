// Generic Supabase access for the Sinking Fund tables (sf_*). Keys are camelCase in the app, snake_case in Postgres.
import { request } from './supabase';
export const SF_TABLES = ['members', 'contributions', 'loans', 'payments', 'balanceDeclarations', 'auditLog', 'settings'];
const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const tbl = (t) => 'sf_' + snake(t);
const NUM = /^(amount|lateFee|principal|monthlyRate|penaltyRate|declaredPrincipal|previousPrincipal|defaultMonthlyRate|defaultPenaltyRate|baseContribution)$/;
const fromRow = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => {
    const c = camel(k);
    return [c, v != null && NUM.test(c) ? Number(v) : v];
}));
const toRow = (r) => Object.fromEntries(Object.entries(r)
    .filter(([k]) => !['id', 'createdAt'].includes(k))
    .map(([k, v]) => [snake(k), v === '' || v === undefined ? null : v]));
export const sf = {
    async list(t, limit = 5000) {
        const order = t === 'auditLog' ? 'created_at.desc' : 'created_at.asc';
        return (await request(`/rest/v1/${tbl(t)}?select=*&order=${order}&limit=${limit}`)).map(fromRow);
    },
    async get(t, id) {
        const rows = (await request(`/rest/v1/${tbl(t)}?select=*&id=eq.${encodeURIComponent(String(id))}`));
        return rows[0] ? fromRow(rows[0]) : undefined;
    },
    async create(t, rec) {
        return fromRow((await request(`/rest/v1/${tbl(t)}`, { method: 'POST', body: JSON.stringify(toRow(rec)) }))[0]);
    },
    async update(t, id, rec) {
        await request(`/rest/v1/${tbl(t)}?id=eq.${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(toRow(rec)) });
    },
    async remove(t, id) {
        await request(`/rest/v1/${tbl(t)}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    async audit(action, entity, entityId, details, actor) {
        await request('/rest/v1/sf_audit_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ action, entity, entity_id: entityId, details, actor }) });
    },
};
