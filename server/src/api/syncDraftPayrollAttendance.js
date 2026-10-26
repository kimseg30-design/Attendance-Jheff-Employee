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
    inputSchema: z.object({
        employeeId: z.string().optional(),
        employeeIds: z.array(z.string()).min(1).max(100).optional(),
        workDate: z.string(),
    }).refine(({ employeeId, employeeIds }) => Boolean(employeeId) !== Boolean(employeeIds), {
        message: 'Provide either employeeId or employeeIds.',
    }),
    outputSchema: z.object({ updated: z.number() }),
    execute: withLog('syncDraftPayrollAttendance', async ({ input, context }) => {
        await requireAdmin(context.user);
        const employeeIds = [...new Set(input.employeeIds ?? [input.employeeId])];
        const employeeIdSet = new Set(employeeIds);
        let employeesById;
        let slips;
        if (input.employeeId) {
            const employee = await db.employees.findOne({ id: input.employeeId });
            if (!employee)
                return { updated: 0 };
            employeesById = new Map([[employee.id, employee]]);
            slips = await db.payslips.findAll({ limit: 2000 });
        }
        else {
            const [employeesResult, slipsResult] = await Promise.all([
                db.employees.findAll({ limit: 2000 }),
                db.payslips.findAll({ limit: 2000 }),
            ]);
            employeesById = new Map(employeesResult.records.filter((e) => employeeIdSet.has(e.id)).map((e) => [e.id, e]));
            slips = slipsResult;
        }
        if (!employeesById.size)
            return { updated: 0 };
        const matching = slips.records.filter((p) => p.status !== 'Released' &&
            employeeIdSet.has(first(p.employee)) &&
            String(p.periodStart ?? '').slice(0, 10) <= input.workDate &&
            String(p.periodEnd ?? '').slice(0, 10) >= input.workDate);
        if (!matching.length)
            return { updated: 0 };

        // A batch can contain many employees with the same payroll coverage. Read
        // attendance once per distinct coverage instead of once per employee/slip.
        const attendanceByPeriod = new Map();
        for (const slip of matching) {
            const periodStart = String(slip.periodStart).slice(0, 10);
            const periodEnd = String(slip.periodEnd).slice(0, 10);
            const key = `${periodStart}|${periodEnd}`;
            if (!attendanceByPeriod.has(key)) {
                attendanceByPeriod.set(key, db.attendance.findAll({
                    filters: { workDate: { gte: periodStart, lte: periodEnd } },
                    limit: 2000,
                }));
            }
        }
        for (const [key, promise] of attendanceByPeriod) {
            attendanceByPeriod.set(key, await promise);
        }
        let updated = 0;
        for (const slip of matching) {
            const employeeId = first(slip.employee);
            const employee = employeesById.get(employeeId);
            if (!employee)
                continue;
            const periodStart = String(slip.periodStart).slice(0, 10);
            const periodEnd = String(slip.periodEnd).slice(0, 10);
            const attendance = attendanceByPeriod.get(`${periodStart}|${periodEnd}`);
            const logs = attendance.records
                .filter((a) => first(a.employee) === employeeId && String(a.workDate).slice(0, 10) >= periodStart && String(a.workDate).slice(0, 10) <= periodEnd)
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
