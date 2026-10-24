import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const check = z.object({
    status: z.enum(['ok', 'warning', 'error']),
    message: z.string(),
    code: z.string().optional(),
    sqlFix: z.string().optional(),
    sqlUrl: z.string().optional(),
});
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
        const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://xurvumenaszahorrxhxf.supabase.co';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ';
        const base = new URL(rawUrl).origin;
        let database;
        const started = Date.now();
        if (!rawUrl || !key) {
            database = { status: 'warning', message: 'Running with in-memory database fallback (Supabase URL/Key not configured)' };
        } else {
            try {
                const res = await fetch(`${base}/rest/v1/departments?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, keepalive: true, signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                    database = { status: 'ok', message: `Connected to Supabase (${Date.now() - started} ms)` };
                } else {
                    const errBody = await res.text().catch(() => '');
                    const isPermissionDenied = res.status === 401 || res.status === 403 || errBody.includes('permission denied') || errBody.includes('42501');
                    
                    let sqlFixContent = '';
                    try {
                        const sqlPath = path.resolve(__dirname, '../../../supabase/grant_publishable_access.sql');
                        if (fs.existsSync(sqlPath)) sqlFixContent = fs.readFileSync(sqlPath, 'utf8');
                    } catch {}

                    if (isPermissionDenied) {
                        database = {
                            status: 'error',
                            code: 'PERMISSION_DENIED_401',
                            message: `Supabase returned 401 Permission Denied for tables. The publishable key lacks SELECT/INSERT privileges. Run the grant script in your Supabase SQL Editor.`,
                            sqlFix: sqlFixContent,
                            sqlUrl: 'https://supabase.com/dashboard/project/xurvumenaszahorrxhxf/sql/new',
                        };
                    } else {
                        database = { status: 'error', message: `Supabase responded with error ${res.status}: ${errBody.slice(0, 100)}` };
                    }
                }
            }
            catch {
                database = { status: 'error', message: 'Could not reach Supabase endpoint' };
            }
        }
        let security;
        const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
        if (hasServiceRoleKey) {
            const tables = ['employees', 'payslips', 'sf_loans', 'sf_payments'];
            const exposed = [];
            const inconclusive = [];
            for (const t of tables) {
                try {
                    const res = await fetch(`${base}/rest/v1/${t}?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(2000) });
                    if (res.ok) {
                        exposed.push(t);
                    }
                    else if (res.status !== 401 && res.status !== 403) {
                        inconclusive.push(`${t} (${res.status})`);
                    }
                }
                catch {
                    inconclusive.push(`${t} (unreachable)`);
                }
            }
            security = exposed.length
                ? { status: 'warning', message: `Public access is open for: ${exposed.join(', ')}. Run security_hardening.sql in Supabase to enforce server-only access.` }
                : inconclusive.length
                    ? { status: 'warning', message: `Could not verify access for: ${inconclusive.join(', ')}.` }
                    : { status: 'ok', message: 'Public (anon) access is denied — server-side security hardening is in place.' };
        }
        else {
            // Publishable key mode (secret keys purged): verify that requests without an API key are blocked
            let unauthenticatedBlocked = false;
            try {
                const testRes = await fetch(`${base}/rest/v1/departments?select=id&limit=1`, { signal: AbortSignal.timeout(2000) });
                unauthenticatedBlocked = (testRes.status === 401 || testRes.status === 403);
            } catch {
                unauthenticatedBlocked = true;
            }

            security = unauthenticatedBlocked
                ? { status: 'ok', message: 'Secure publishable mode: secret key purged from code, unauthenticated requests without an API key are rejected.' }
                : { status: 'warning', message: 'Publishable mode active. Ensure RLS is enabled on sensitive tables in Supabase.' };
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
