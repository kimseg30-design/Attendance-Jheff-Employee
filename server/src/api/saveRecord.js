import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireTableAccess } from '../lib/roles.js';
import { TABLES, tableClient } from '../lib/tables.js';
import { syncLeaveCredits } from '../lib/leaveCredits.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Creates or updates a record in one of the HR tables',
    inputSchema: z.object({
        table: z.enum(TABLES),
        id: z.string().optional(),
        record: z.record(z.any()).refine((value) => Object.keys(value).length <= 50 && JSON.stringify(value).length <= 50_000, { message: 'Record payload is too large.' }),
    }),
    outputSchema: z.object({ id: z.string() }),
    execute: withLog('saveRecord', async ({ input, context }) => {
        await requireTableAccess(context.user, input.table, 'write');
        const client = tableClient(input.table);
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
