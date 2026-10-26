import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { getRole, requireMember, requireTableAccess } from '../lib/roles.js';
import { TABLES, tableClient } from '../lib/tables.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Lists records from one of the HR tables',
    inputSchema: z.object({ table: z.enum(TABLES) }),
    outputSchema: z.object({ records: z.array(z.record(z.any())) }),
    execute: withLog('listRecords', async ({ input, context }) => {
        // Keep this guard at runtime as the Express handler currently falls back to
        // the raw request body when schema validation fails. That turns an
        // invalid/stale client table name into an opaque "findAll" TypeError.
        const client = TABLES.includes(input?.table) ? tableClient(input.table) : null;
        if (!client || typeof client.findAll !== 'function') {
            throw new Error(`Unsupported records table: ${String(input?.table ?? '')}`);
        }
        const role = await getRole(context.user);
        if (role === 'Admin' || role === 'Viewer')
            await requireMember(context.user);
        else
            await requireTableAccess(context.user, input.table, 'read');
        const { records } = await client.findAll({ limit: 2000 });
        if (role === 'Editor' && input.table === 'employees') {
            return { records: records.map((r) => ({ id: r.id, fullName: r.fullName, active: r.active })) };
        }
        if (input.table === 'attendance') {
            const seen = new Map();
            for (const r of records) {
                const empId = Array.isArray(r.employee) ? r.employee[0] : r.employee;
                const date = String(r.workDate || '').slice(0, 10);
                if (!empId || !date) continue;
                const key = `${empId}_${date}`;
                if (!seen.has(key)) {
                    seen.set(key, r);
                }
            }
            return { records: Array.from(seen.values()) };
        }
        return { records };
    }),
});
