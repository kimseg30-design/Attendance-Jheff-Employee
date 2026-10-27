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

        // Fetch existing attendance records for this workDate to strictly avoid duplicates
        const existing = await db.attendance.findAll({ filters: { workDate: input.workDate }, limit: 2000 });
        const existingByEmp = new Map();
        const duplicatesToDelete = [];

        for (const rec of existing.records || []) {
            const empId = Array.isArray(rec.employee) ? rec.employee[0] : rec.employee;
            const date = String(rec.workDate || '').slice(0, 10);
            if (empId && date === input.workDate) {
                if (!existingByEmp.has(empId)) {
                    existingByEmp.set(empId, rec);
                } else {
                    // Pre-existing duplicate, queue for removal
                    duplicatesToDelete.push(rec.id);
                }
            }
        }

        // Clean up any pre-existing duplicates for this date
        for (const dupId of duplicatesToDelete) {
            try {
                await db.attendance.delete({ id: dupId });
            } catch (err) {
                console.warn('Failed to prune duplicate attendance record', dupId, err);
            }
        }

        const toCreate = [];

        for (const id of input.employeeIds) {
            // Strictly no duplication: skip employees that already have a record
            // for this date so the existing status is never overwritten.
            if (existingByEmp.has(id)) {
                continue;
            }
            const record = {
                employee: [id],
                workDate: input.workDate,
                status: input.status,
                dayType: input.dayType,
                timeIn: ['Present', 'Halfday'].includes(input.status) ? input.timeIn ?? null : null,
                timeOut: ['Present', 'Halfday'].includes(input.status) ? input.timeOut ?? null : null,
                lateMinutes: ['Present', 'Halfday'].includes(input.status) ? input.lateMinutes ?? 0 : 0,
                overtimeHours: 0,
                nightDiffHours: 0,
            };
            toCreate.push(record);
        }

        // Create new records only for employees who do not already have one
        for (let i = 0; i < toCreate.length; i += 100) {
            await db.attendance.bulkCreate({ records: toCreate.slice(i, i + 100) });
        }

        if (input.status === 'Paid Leave') {
            for (const r of toCreate)
                await syncLeaveCredits('attendance', undefined, r);
        }

        return { created: toCreate.length };
    }),
});