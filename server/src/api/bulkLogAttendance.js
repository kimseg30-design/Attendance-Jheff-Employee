import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireTableAccess } from '../lib/roles.js';
import { db } from '../lib/supabase.js';
import { syncLeaveCredits } from '../lib/leaveCredits.js';
import { withLog } from '../lib/guard.js';
export default createEndpoint({
    authenticated: true,
    description: 'Logs attendance for many employees at once',
    inputSchema: z.object({
        employeeIds: z.array(z.string().uuid()).min(1).max(100),
        workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(['Present', 'Halfday', 'Absent', 'Paid Leave', 'Rest Day']),
        dayType: z.enum(['Regular Day', 'Regular Holiday', 'Special Non-Working', 'Rest Day']),
        timeIn: z.string().optional(),
        timeOut: z.string().optional(),
        lateMinutes: z.number().optional(),
    }),
    outputSchema: z.object({ created: z.number() }),
    execute: withLog('bulkLogAttendance', async ({ input, context }) => {
        await requireTableAccess(context.user, 'attendance', 'write');
        const records = input.employeeIds.map((id) => ({
            employee: [id],
            workDate: input.workDate,
            status: input.status,
            dayType: input.dayType,
            timeIn: ['Present', 'Halfday'].includes(input.status) ? input.timeIn ?? null : null,
            timeOut: ['Present', 'Halfday'].includes(input.status) ? input.timeOut ?? null : null,
            lateMinutes: ['Present', 'Halfday'].includes(input.status) ? input.lateMinutes ?? 0 : 0,
            overtimeHours: 0,
            nightDiffHours: 0,
        }));
        for (let i = 0; i < records.length; i += 100) {
            await db.attendance.bulkCreate({ records: records.slice(i, i + 100) });
        }
        if (input.status === 'Paid Leave') {
            for (const r of records)
                await syncLeaveCredits('attendance', undefined, r);
        }
        return { created: records.length };
    }),
});
