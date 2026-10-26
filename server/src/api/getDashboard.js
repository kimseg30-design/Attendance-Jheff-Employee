import { z } from 'zod';
import { addDays, format, parseISO } from 'date-fns';
import { createEndpoint } from '../zite/backend.js';
import { requireMember } from '../lib/roles.js';
import { request, rpc } from '../lib/supabase.js';
import { withLog } from '../lib/guard.js';
const phToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
export default createEndpoint({
    authenticated: true,
    description: 'Returns headline HR and payroll stats for the dashboard as of a chosen date',
    inputSchema: z.object({ date: z.string().optional() }),
    outputSchema: z.object({
        date: z.string(),
        activeEmployees: z.number(),
        presentToday: z.number(),
        halfdayToday: z.number(),
        restDayToday: z.number(),
        absentToday: z.number(),
        pendingLeaves: z.number(),
        outstandingLoans: z.number(),
        outstandingCashAdvance: z.number(),
        lastPayrollTotal: z.number(),
        lastPayrollLabel: z.string().nullable(),
        attendanceByDay: z.array(z.object({
            date: z.string(),
            present: z.number(),
            halfday: z.number(),
            restDay: z.number(),
            absent: z.number()
        })),
        byDepartment: z.array(z.object({ name: z.string(), count: z.number() })),
    }),
    execute: withLog('getDashboard', async ({ input, context }) => {
        await requireMember(context.user);
        const today = phToday();
        const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) && input.date <= today ? input.date : today;
        const start = format(addDays(parseISO(date), -13), 'yyyy-MM-dd');
        const [d, att, slips, caList] = await Promise.all([
            rpc('get_dashboard'),
            request(`/rest/v1/attendance?select=work_date,status,day_type,employee_id&work_date=gte.${start}&work_date=lte.${date}&limit=20000`),
            request(`/rest/v1/payslips?select=period_label,period_end,net_pay&period_end=lte.${date}&order=period_end.desc&limit=5000`),
            request(`/rest/v1/cash_advances?select=type,balance,status&status=eq.Active&limit=5000`),
        ]);
        const days = {};
        for (let i = 0; i < 14; i++)
            days[format(addDays(parseISO(start), i), 'yyyy-MM-dd')] = { present: 0, halfday: 0, restDay: 0, absent: 0 };

        // Deduplicate attendance entries strictly by (employee, workDate)
        const seenAttendance = new Set();
        for (const r of (att || [])) {
            const empId = r.employee_id || (Array.isArray(r.employee) ? r.employee[0] : r.employee);
            const k = String(r.work_date || r.workDate || '').slice(0, 10);
            if (empId) {
                const uniqueKey = `${empId}_${k}`;
                if (seenAttendance.has(uniqueKey)) continue;
                seenAttendance.add(uniqueKey);
            }
            if (!days[k])
                continue;
            const status = String(r.status || '').trim();
            const dayType = String(r.day_type || r.dayType || '').trim();
            if (status === 'Halfday' || status === 'Half Day') {
                days[k].halfday++;
            } else if (status === 'Rest Day' || dayType === 'Rest Day') {
                days[k].restDay++;
            } else if (status === 'Present' || status === 'Paid Leave') {
                days[k].present++;
            } else if (status === 'Absent') {
                days[k].absent++;
            }
        }
        const last = (slips || [])[0];
        const lastRows = last ? slips.filter((s) => s.period_label === last.period_label && s.period_end === last.period_end) : [];

        // Calculate Cash Advance balance (status = 'Active')
        const activeCas = Array.isArray(caList) ? caList.filter((c) => c.status === 'Active') : [];
        const cashAdvanceOnly = activeCas.filter((c) => !c.type || c.type === 'Cash Advance');
        const totalCashAdvance = cashAdvanceOnly.length > 0
            ? cashAdvanceOnly.reduce((sum, c) => sum + Number(c.balance || 0), 0)
            : activeCas.reduce((sum, c) => sum + Number(c.balance || 0), 0);
        const resolvedCashAdvance = totalCashAdvance || Number(d?.outstandingCashAdvance ?? d?.outstandingLoans ?? 0);

        return {
            date,
            activeEmployees: Number(d?.activeEmployees ?? 0),
            presentToday: days[date]?.present ?? Number(d?.presentToday ?? 0),
            halfdayToday: days[date]?.halfday ?? Number(d?.halfdayToday ?? 0),
            restDayToday: days[date]?.restDay ?? Number(d?.restDayToday ?? 0),
            absentToday: days[date]?.absent ?? Number(d?.absentToday ?? 0),
            pendingLeaves: Number(d?.pendingLeaves ?? 0),
            outstandingLoans: resolvedCashAdvance,
            outstandingCashAdvance: resolvedCashAdvance,
            lastPayrollTotal: lastRows.reduce((a, s) => a + Number(s.net_pay || 0), 0),
            lastPayrollLabel: last?.period_label ? String(last.period_label) : null,
            attendanceByDay: Object.entries(days).map(([k, v]) => ({ date: k, ...v })),
            byDepartment: (d?.byDepartment ?? []).map((r) => ({ name: String(r.name), count: Number(r.count) })),
        };
    }),
});
