import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
const check = z.object({ status: z.enum(['ok', 'warning', 'error']), message: z.string() });
export default createEndpoint({
    authenticated: true,
    description: 'Admin-only health check: database connection, security lock-down and recent failed actions',
    inputSchema: z.object({}),
    outputSchema: z.object({
        database: check,
        security: check,
        failures: z.array(z.object({ id: z.string(), summary: z.string(), errorCode: z.string(), userEmail: z.string(), details: z.string(), endpoint: z.string(), occurredAt: z.string() })),
        failuresLast24h: z.number(),
    }),
    execute: withLog('getSystemHealth', async ({ context }) => {
        await requireAdmin(context.user, 'read');
        const rawUrl = process.env.ZITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.ZITE_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        let database;
        const started = Date.now();
        if (!rawUrl || !key) {
            database = { status: 'warning', message: 'Running with in-memory database fallback (Supabase URL/Key not configured)' };
        } else {
            try {
                const base = new URL(rawUrl).origin;
                const res = await fetch(`${base}/rest/v1/departments?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
                database = res.ok
                    ? { status: 'ok', message: `Connected to Supabase (${Date.now() - started} ms)` }
                    : { status: 'error', message: `Supabase responded with error ${res.status}` };
            }
            catch {
                database = { status: 'error', message: 'Could not reach Supabase' };
            }
        }
        let security;
        const anonKey = process.env.ZITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!anonKey) {
            security = { status: 'warning', message: 'Not tested — add the Supabase public (anon) key as the ZITE_SUPABASE_ANON_KEY secret to verify outsiders are blocked.' };
        }
        else {
            const tables = ['employees', 'payslips', 'sf_loans', 'sf_payments'];
            const exposed = [];
            const inconclusive = [];
            for (const t of tables) {
                try {
                    const res = await fetch(`${base}/rest/v1/${t}?select=id&limit=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
                    // Any successful response proves the public role can reach the table, even if it is empty.
                    if (res.ok) {
                        exposed.push(t);
                    }
                    else {
                        const body = await res.text();
                        const invalidKey = /invalid api key|invalid jwt|jwt expired|no api key|api key is required/i.test(body);
                        if (invalidKey || (res.status !== 401 && res.status !== 403))
                            inconclusive.push(`${t} (${res.status})`);
                    }
                }
                catch {
                    inconclusive.push(`${t} (unreachable)`);
                }
            }
            security = exposed.length
                ? { status: 'error', message: `Public access is NOT blocked for: ${exposed.join(', ')}. Run security_hardening.sql in Supabase.` }
                : inconclusive.length
                    ? { status: 'warning', message: `Could not verify public access for: ${inconclusive.join(', ')}. Review Supabase permissions manually.` }
                    : { status: 'ok', message: 'Public (anon) access is denied — security hardening is in place.' };
        }
        const [{ rows }, countRes] = await Promise.all([
            zite.sql({ query: 'SELECT "id", "summary", "errorCode", "userEmail", "details", "endpoint", "occurredAt" FROM "FailedActions" ORDER BY "occurredAt" DESC LIMIT 10' }),
            zite.sql({ query: `SELECT COUNT(*)::int AS "n" FROM "FailedActions" WHERE "occurredAt" >= NOW() - INTERVAL '24 hours'` }),
        ]);
        const failures = rows.map((r) => ({
            id: String(r.id), summary: String(r.summary ?? ''), errorCode: String(r.errorCode ?? ''),
            userEmail: String(r.userEmail ?? ''), details: String(r.details ?? ''), endpoint: String(r.endpoint ?? ''), occurredAt: String(r.occurredAt ?? ''),
        }));
        return { database, security, failures, failuresLast24h: Number(countRes.rows[0]?.n ?? 0) };
    }),
});
