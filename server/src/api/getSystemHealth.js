import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { zite } from '../zite/db.js';
import { requireAdmin } from '../lib/roles.js';
import { withLog } from '../lib/guard.js';
import { getCacheHealth } from '../lib/cache.js';

const check = z.object({
    status: z.enum(['ok', 'warning', 'error']),
    message: z.string(),
    code: z.string().optional(),
    sqlFix: z.string().optional(),
    sqlUrl: z.string().optional(),
});
export default createEndpoint({
    authenticated: true,
    description: 'Admin-only health check: database connection, redis/cache layer, zero-downtime indexes, and recent failed actions',
    inputSchema: z.object({}),
    outputSchema: z.object({
        database: check,
        security: check,
        cache: check.optional(),
        indexing: check.optional(),
        failures: z.array(z.object({ id: z.string(), summary: z.string(), errorCode: z.string(), userEmail: z.string(), details: z.string(), endpoint: z.string(), occurredAt: z.string() })),
        failuresLast24h: z.number(),
    }),
    execute: withLog('getSystemHealth', async ({ context }) => {
        await requireAdmin(context.user, 'read');
        const rawUrl = process.env.SUPABASE_URL || '';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const base = rawUrl ? new URL(rawUrl).origin : '';
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
                    
                    if (isPermissionDenied) {
                        database = {
                            status: 'error',
                            code: 'PERMISSION_DENIED_401',
                            message: 'Supabase denied table access. Configure a server-only secret/service-role key and verify the secure RLS setup; do not grant broad anon access.',
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
        const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
        const security = {
            status: 'warning',
            code: 'rls_unverified',
            message: hasServiceRoleKey
                ? 'The server key bypasses RLS. This endpoint cannot inspect pg_policies or verify direct anon/auth access; check those in Supabase before changing policies.'
                : 'RLS policies and direct anon/auth access have not been verified. Keep payroll data behind the authenticated server API; do not grant broad anon access.',
        };
        const [{ rows }, countRes] = await Promise.all([
            zite.sql({ query: 'SELECT "id", "summary", "errorCode", "userEmail", "details", "endpoint", "occurredAt" FROM "FailedActions" ORDER BY "occurredAt" DESC LIMIT 10' }),
            zite.sql({ query: `SELECT COUNT(*)::int AS "n" FROM "FailedActions" WHERE "occurredAt" >= NOW() - INTERVAL '24 hours'` }),
        ]);
        const failures = rows.map((r) => ({
            id: String(r.id), summary: String(r.summary ?? ''), errorCode: String(r.errorCode ?? ''),
            userEmail: String(r.userEmail ?? ''), details: String(r.details ?? ''), endpoint: String(r.endpoint ?? ''), occurredAt: String(r.occurredAt ?? ''),
        }));

        const cacheHealth = await getCacheHealth();
        const cache = {
            status: 'ok',
            message: `${cacheHealth.engine} active · ${cacheHealth.cachedKeysCount} keys (${cacheHealth.hits} hits, ${cacheHealth.hitRatio} hit ratio). Cache latency is not measured as PostgreSQL latency.`,
            code: cacheHealth.zeroConfig ? 'process_memory_cache_active' : 'redis_cache_active',
        };

        const indexing = {
            status: 'warning',
            message: 'Installed indexes, pg_stat_statements, and query plans have not been inspected; database latency is unverified.',
        };

        return { database, security, cache, indexing, failures, failuresLast24h: Number(countRes.rows[0]?.n ?? 0) };
    }),
});
