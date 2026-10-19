import { z } from 'zod';
import { createEndpoint } from '../zite/backend.js';
import { requireAdmin } from '../lib/roles.js';
import { db } from '../lib/supabase.js';
import { computePayslip } from '../lib/payrollCalc.js';
import { withLog } from '../lib/guard.js';
const first = (v) => (Array.isArray(v) ? v[0] : v);
const r2 = (n) => Math.round(n * 100) / 100;
export default createEndpoint({
    authenticated: true,
    description: 'Refreshes draft payslip earnings when an attendance record is edited',
    inputSchema: z.object({ employeeId: z.string(), workDate: z.string() }),
    outputSchema: z.object({ updated: z.number() }),
    execute: withLog('syncDraftPayrollAttendance', async ({ input, context }) => {
        await requireAdmin(context.user);
        const employee = await db.employees.findOne({ id: input.employeeId });
        if (!employee)
            return { updated: 0 };
        const slips = await db.payslips.findAll({ limit: 2000 });
        const matching = slips.records.filter((p) => p.status !== 'Released' &&
            first(p.employee) === input.employeeId &&
            String(p.periodStart ?? '').slice(0, 10) <= input.workDate &&
            String(p.periodEnd ?? '').slice(0, 10) >= input.workDate);
        let updated = 0;
        for (const slip of matching) {
            const attendance = await db.attendance.findAll({ filters: { workDate: { gte: String(slip.periodStart).slice(0, 10) } }, limit: 2000 });
            const logs = attendance.records
                .filter((a) => first(a.employee) === input.employeeId && String(a.workDate).slice(0, 10) <= String(slip.periodEnd).slice(0, 10))
                .map((a) => ({
                status: a.status ?? 'Present',
                dayType: a.dayType ?? 'Regular Day',
                lateMinutes: Number(a.lateMinutes ?? 0),
                overtimeHours: Number(a.overtimeHours ?? 0),
                nightDiffHours: Number(a.nightDiffHours ?? 0),
                overtimePayMode: a.overtimePayMode ?? 'Hours',
                overtimeAmount: Number(a.overtimeAmount ?? 0),
                otherBenefit: Number(a.otherBenefit ?? 0),
            }));
            const frequency = String(slip.periodLabel ?? '').toLowerCase().includes('week') ? 'weekly' : 'semi-monthly';
            // Recalculate earning components; preserve the deductions already selected for this payslip.
            const fresh = computePayslip(Number(employee.dailyRate ?? 0), logs, 0, frequency, {
                sss: false, philHealth: false, pagIbig: false, tax: false,
            });
            const oldGross = Number(slip.grossPay ?? 0);
            const delta = r2(fresh.grossPay - oldGross);
            await db.payslips.update({ id: slip.id, record: {
                    daysWorked: fresh.daysWorked,
                    daysAbsent: fresh.daysAbsent,
                    basicPay: fresh.basicPay,
                    overtimePay: fresh.overtimePay,
                    otherBenefits: fresh.otherBenefits,
                    nightDiffPay: fresh.nightDiffPay,
                    holidayPay: fresh.holidayPay,
                    lateDeduction: fresh.lateDeduction,
                    grossPay: fresh.grossPay,
                    netPay: r2(Number(slip.netPay ?? 0) + delta),
                } });
            updated++;
        }
        return { updated };
    }),
});
