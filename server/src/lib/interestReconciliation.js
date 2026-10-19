import { addMonths, differenceInCalendarMonths, format, parseISO } from 'date-fns';
import { calcLoan, firstDueFor } from './loanCalc.js';
export function reconcileHistoricalInterest(loan, allPayments, declarations) {
    const history = declarations
        .filter((d) => String(d.loanId) === String(loan.id) && d.declaredAt)
        .sort((a, b) => String(a.declaredAt).localeCompare(String(b.declaredAt)) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
    const rate = (Number(loan.monthlyRate) || 0) / 100;
    const loanStart = parseISO(String(loan.startDate));
    let segmentStart = String(loan.startDate);
    let segmentPrincipal = Number(loan.principal) || 0;
    let segmentIndex = 0;
    // Interest months already collected, counted from the loan start — a month is never charged twice.
    let monthsCovered = 0;
    const result = [];
    for (const declaration of history) {
        const boundary = String(declaration.declaredAt).slice(0, 10);
        const payments = allPayments.filter((p) => String(p.loanId) === String(loan.id) &&
            (segmentIndex === 0 ? String(p.paidOn).slice(0, 10) >= segmentStart : String(p.paidOn).slice(0, 10) > segmentStart) &&
            String(p.paidOn).slice(0, 10) <= boundary);
        const elapsed = Math.max(0, differenceInCalendarMonths(parseISO(boundary), loanStart));
        const segmentLoan = {
            ...loan,
            principal: segmentPrincipal,
            startDate: segmentStart,
            firstDueDate: firstDueFor(segmentStart, String(loan.frequency ?? 'Monthly')),
            termMonths: Math.max(1, (Number(loan.termMonths) || 1) - elapsed),
            declaredPrincipal: null,
            declaredAt: null,
        };
        let interest = calcLoan(segmentLoan, payments, boundary).interestPaid;
        const paidThrough = format(addMonths(loanStart, monthsCovered), 'yyyy-MM-dd');
        const allInsideCovered = payments.length > 0 && payments.every((p) => String(p.paidOn).slice(0, 10) <= paidThrough);
        if (monthsCovered > 0 && allInsideCovered)
            interest = 0;
        const monthly = segmentPrincipal * rate;
        if (monthly > 0 && interest > 0)
            monthsCovered += Math.round(interest / monthly);
        result.push({
            declarationId: String(declaration.id),
            declaredAt: boundary,
            previousPrincipal: Number(declaration.previousPrincipal ?? segmentPrincipal) || 0,
            declaredPrincipal: Number(declaration.declaredPrincipal) || 0,
            paymentsRecorded: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
            historicalInterestPaid: interest,
        });
        segmentStart = boundary;
        segmentPrincipal = Number(declaration.declaredPrincipal) || 0;
        segmentIndex++;
    }
    return result;
}
export function historicalInterestTotal(loan, allPayments, declarations) {
    return Math.round(reconcileHistoricalInterest(loan, allPayments, declarations)
        .reduce((sum, segment) => sum + segment.historicalInterestPaid, 0) * 100) / 100;
}
