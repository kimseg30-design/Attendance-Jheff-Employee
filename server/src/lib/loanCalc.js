// Sinking Fund loan engine — simple interest, cycle-by-cycle accrual, paid-through protection,
// installment schedule, late penalties. All dates are Philippine calendar dates (YYYY-MM-DD).
import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, parseISO } from 'date-fns';
export const phToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const d = (s) => parseISO(String(s).slice(0, 10));
const iso = (x) => format(x, 'yyyy-MM-dd');
const r2 = (n) => Math.round(n * 100) / 100;
export const PERIOD_DAYS = { Weekly: 7, Biweekly: 14, Monthly: 0 };
export const PER_MONTH = { Weekly: 4, Biweekly: 2, Monthly: 1 };
export function firstDueFor(start, frequency) {
    return frequency === 'Monthly' ? iso(addMonths(d(start), 1)) : iso(addDays(d(start), PERIOD_DAYS[frequency]));
}
const nthDue = (first, frequency, i) => frequency === 'Monthly' ? iso(addMonths(d(first), i)) : iso(addDays(d(first), PERIOD_DAYS[frequency] * i));
export function calcLoan(loan, allPayments, asOf = phToday()) {
    const declared = loan.declaredPrincipal != null && loan.declaredAt;
    const basePrincipal = Number(declared ? loan.declaredPrincipal : loan.principal) || 0;
    const baseDate = declared ? loan.declaredAt : loan.startDate;
    const elapsedBefore = declared ? Math.max(0, differenceInCalendarMonths(d(baseDate), d(loan.startDate))) : 0;
    const term = Math.max(1, (Number(loan.termMonths) || 1) - elapsedBefore);
    const mi = r2(basePrincipal * (Number(loan.monthlyRate) || 0) / 100);
    // Installment schedule uses the original term only.
    const installments = term * PER_MONTH[loan.frequency ?? 'Monthly'];
    const firstDue = declared || !loan.firstDueDate ? firstDueFor(baseDate, loan.frequency) : loan.firstDueDate;
    const schedule = Array.from({ length: installments }, (_, i) => nthDue(firstDue, loan.frequency, i));
    const maturity = schedule[schedule.length - 1] ?? baseDate;
    const termCycles = loan.earlySettlement ? 1 : term;
    // Post-maturity: one fixed cycle (original principal × rate) the day after maturity, then monthly.
    const postCyclesAt = (date) => {
        if (loan.earlySettlement)
            return 0;
        let n = 0;
        while (d(date) > addMonths(d(maturity), n))
            n++;
        return n;
    };
    // In-term: one cycle at release, +1 at each monthly anniversary until the term ends.
    const cyclesAt = (date) => {
        let c = 1;
        for (let k = 1; k < termCycles; k++)
            if (d(date) > addMonths(d(baseDate), k))
                c++;
        return c + postCyclesAt(date);
    };
    const payments = allPayments
        .filter((p) => p.loanId === loan.id && (!declared || p.paidOn > baseDate))
        .sort((a, b) => (a.paidOn === b.paidOn ? String(a.createdAt).localeCompare(String(b.createdAt)) : a.paidOn.localeCompare(b.paidOn)));
    // Interest stops once the loan is fully settled: freeze the accrual date at the payoff date.
    let effAsOf = asOf;
    {
        let paidSum = 0;
        for (const p of payments) {
            if (p.paidOn > asOf)
                break;
            paidSum += Number(p.amount) || 0;
            if (paidSum + 0.009 >= basePrincipal + cyclesAt(p.paidOn) * mi) {
                effAsOf = p.paidOn;
                break;
            }
        }
    }
    const maxCycles = Math.max(cyclesAt(effAsOf), termCycles) + (loan.earlySettlement ? 0 : 1);
    let interestPaid = 0, principalPaid = 0, lateFeesPaid = 0, cash = 0;
    const ledger = [];
    for (const p of payments) {
        const amount = Number(p.amount) || 0, lateFee = Number(p.lateFee) || 0;
        const principalLeft = basePrincipal - principalPaid;
        const interestCap = maxCycles * mi - interestPaid;
        const due = Math.max(0, cyclesAt(p.paidOn) * mi - interestPaid);
        let interest = Math.min(amount, p.prepayInterest ? interestCap : due);
        let principal = Math.min(amount - interest, principalLeft);
        const extra = amount - interest - principal; // overpayment beyond principal → prepaid interest
        if (extra > 0)
            interest += Math.min(extra, interestCap - interest);
        interest = r2(interest);
        principal = r2(principal);
        interestPaid += interest;
        principalPaid += principal;
        lateFeesPaid += lateFee;
        cash += amount + lateFee;
        const charged = Math.max(cyclesAt(p.paidOn), Math.min(maxCycles, Math.floor(interestPaid / (mi || 1) + 1e-9)));
        ledger.push({
            id: p.id, paidOn: p.paidOn, amount, lateFee, interest, principal,
            principalBalance: r2(basePrincipal - principalPaid),
            balance: r2(Math.max(0, basePrincipal - principalPaid + charged * mi - interestPaid)),
            cashCollected: r2(cash), referenceNo: p.referenceNo, receiptUrl: p.receiptUrl, prepayInterest: p.prepayInterest,
        });
    }
    const monthsPrepaid = mi > 0 ? Math.min(maxCycles, Math.floor(interestPaid / mi + 1e-9)) : 0;
    const principalBalance = r2(Math.max(0, basePrincipal - principalPaid));
    // Paid-through protection: once interest is prepaid, no new cycle is added until the paid-through date passes.
    const cyclesCharged = Math.max(cyclesAt(effAsOf), monthsPrepaid);
    const interestCharged = r2(cyclesCharged * mi);
    const accruedInterest = r2(Math.max(0, interestCharged - interestPaid));
    const balance = r2(principalBalance + accruedInterest);
    const postMaturityCycles = postCyclesAt(effAsOf);
    const nextInterestDate = balance > 0.009 && !loan.earlySettlement && d(asOf) >= d(maturity)
        ? iso(addDays(addMonths(d(maturity), postCyclesAt(asOf)), 1)) : null;
    // Whole-peso installments (rounded up); the final installment absorbs the difference.
    const termTotal = r2(basePrincipal + termCycles * mi);
    const installment = Math.ceil(termTotal / installments - 1e-9);
    const finalInstallment = r2(Math.max(0, termTotal - installment * (installments - 1)));
    const paidTowardSchedule = interestPaid + principalPaid;
    // Scale the outstanding schedule to the live balance. Any overpayment (e.g. ₱690
    // against a ₱688 installment) reduces the remaining balance and recalculates future
    // installments instead of leaving the original fixed amounts in the schedule.
    const completedInstallments = Math.min(installments, Math.floor((paidTowardSchedule + 0.01) / (installment || 1)));
    const remainingInstallments = Math.max(1, installments - completedInstallments);
    const scaledInstallment = Math.ceil(Math.max(0, balance) / remainingInstallments - 1e-9);
    const scheduleAmounts = schedule.map((_, i) => {
        if (i < completedInstallments)
            return 0;
        return i === installments - 1 ? r2(Math.max(0, balance - scaledInstallment * (remainingInstallments - 1))) : r2(scaledInstallment);
    });
    const grace = Number(loan.graceDays ?? 3);
    const pastDue = schedule.filter((s) => differenceInCalendarDays(d(asOf), d(s)) > grace).length;
    const expected = pastDue >= schedule.length ? basePrincipal + interestCharged : Math.min(pastDue * installment, basePrincipal + termCycles * mi);
    const overdueAmount = r2(Math.max(0, Math.min(expected - paidTowardSchedule, balance)));
    const overdue = balance > 0.009 && overdueAmount > 0.009;
    const unmetIdx = Math.min(schedule.length - 1, Math.floor((paidTowardSchedule + 0.01) / (installment || 1)));
    const nextDue = balance > 0.009 ? schedule[unmetIdx] ?? null : null;
    const daysOverdue = overdue && nextDue ? Math.max(0, differenceInCalendarDays(d(asOf), d(nextDue))) : 0;
    const pendingLateFee = overdue ? r2(overdueAmount * (Number(loan.penaltyRate ?? 2) / 100)) : 0;
    return {
        loan, basePrincipal, baseDate, term, monthlyInterest: mi, cyclesCharged, monthsPrepaid,
        paidThrough: monthsPrepaid > 0 ? iso(addMonths(d(baseDate), monthsPrepaid)) : null,
        interestCharged, interestPaid: r2(interestPaid), principalPaid: r2(principalPaid), lateFeesPaid: r2(lateFeesPaid), totalCollected: r2(cash),
        principalBalance, accruedInterest, balance,
        installment, finalInstallment, installments, schedule, scheduleAmounts, nextDue, maturity, postMaturityCycles, postMaturityInterest: r2(postMaturityCycles * mi), nextInterestDate,
        status: balance <= 0.009 ? 'Fully Paid' : payments.length ? 'Partial' : 'Unpaid',
        overdue, daysOverdue, overdueAmount, pendingLateFee, ledger,
    };
}
// ── number to words (Philippine peso) ──
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function chunk(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? '-' + ONES[r % 10] : ''}`;
    return [h ? `${ONES[h]} Hundred` : '', rest].filter(Boolean).join(' ');
}
export function numberToWords(n) {
    let whole = Math.floor(n);
    const cents = Math.round((n - whole) * 100);
    if (whole === 0)
        return `Zero Pesos${cents ? ` and ${cents}/100` : ''}`;
    const parts = [];
    for (const [v, name] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [1, '']]) {
        const c = Math.floor(whole / v);
        whole %= v;
        if (c)
            parts.push(`${chunk(c)}${name ? ' ' + name : ''}`);
    }
    return `${parts.join(' ')} Pesos${cents ? ` and ${String(cents).padStart(2, '0')}/100` : ' Only'}`;
}
