import { z } from 'zod';
import { createEndpoint, ZiteError } from '../zite/backend.js';
import { requireTableAccess } from '../lib/roles.js';
import { TABLES, tableClient } from '../lib/tables.js';
import { syncLeaveCredits } from '../lib/leaveCredits.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Creates or updates a record in one of the HR tables with strict deduplication for attendance',
    inputSchema: z.object({
        table: z.enum(TABLES),
        id: z.string().optional(),
        record: z.record(z.any()).refine((value) => Object.keys(value).length <= 50 && JSON.stringify(value).length <= 50_000, { message: 'Record payload is too large.' }),
    }),
    outputSchema: z.object({ id: z.string() }),
    execute: withLog('saveRecord', async ({ input, context }) => {
        await requireTableAccess(context.user, input.table, 'write');
        const client = tableClient(input.table);

        if (input.table === 'attendance') {
            const empId = Array.isArray(input.record.employee) ? input.record.employee[0] : input.record.employee;
            const workDate = String(input.record.workDate || '').slice(0, 10);
            if (empId && workDate) {
                const existing = await client.findAll({ filters: { workDate }, limit: 2000 });
                const match = (existing?.records || []).find((r) => {
                    const rEmpId = Array.isArray(r.employee) ? r.employee[0] : r.employee;
                    return rEmpId === empId && String(r.workDate || '').slice(0, 10) === workDate;
                });
                if (match) {
                    if (input.id && input.id !== match.id) {
                        throw new ZiteError(`An attendance record for this employee on ${workDate} already exists (${match.status}). Duplication is strictly prevented.`, 400);
                    }
                    // Upsert into the existing record to strictly avoid duplication
                    const before = match;
                    await client.update({ id: match.id, record: input.record });
                    await syncLeaveCredits(input.table, before, { ...before, ...input.record });
                    return { id: match.id };
                }
            }
        }

        if (input.id) {
            const before = await client.findOne({ id: input.id });
            await client.update({ id: input.id, record: input.record });
            await syncLeaveCredits(input.table, before, { ...before, ...input.record });
            return { id: input.id };
        }
        const created = await client.create({ record: input.record });
        await syncLeaveCredits(input.table, undefined, input.record);
        return { id: created.id };
    }),
});
