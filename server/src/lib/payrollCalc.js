// Philippine payroll rules (semi-monthly cutoffs, TRAIN law 2023+ tax table, 2025 contribution rates).
const r2 = (n) => Math.round(n * 100) / 100;
export function sssEmployeeMonthly(monthly) {
    const msc = Math.min(35000, Math.max(5000, Math.round(monthly / 500) * 500));
    return msc * 0.05;
}
export function philHealthEmployeeMonthly(monthly) {
    const base = Math.min(100000, Math.max(10000, monthly));
    return base * 0.025;
}
export function pagIbigEmployeeMonthly(monthly) {
    return Math.min(monthly, 10000) * 0.02;
}
export function semiMonthlyTax(taxable) {
    const brackets = [
        [333333, 91770.7, 0.35],
        [83333, 16770.7, 0.3],
        [33333, 4270.7, 0.25],
        [16667, 937.5, 0.2],
        [10417, 0, 0.15],
    ];
    for (const [floor, base, rate] of brackets) {
        if (taxable >= floor)
            return r2(base + (taxable - floor) * rate);
    }
    return 0;
}
export function weeklyTax(taxable) {
    const brackets = [
        [153846, 42355.65, 0.35],
        [38462, 7740.45, 0.3],
        [15385, 1971.2, 0.25],
        [7692, 432.6, 0.2],
        [4808, 0, 0.15],
    ];
    for (const [floor, base, rate] of brackets) {
        if (taxable >= floor)
            return r2(base + (taxable - floor) * rate);
    }
    return 0;
}
const DAY_PREMIUM = {
    'Regular Day': 0,
    'Regular Holiday': 1,
    'Special Non-Working': 0.3,
    'Rest Day': 0.3,
};
const ALL = { sss: true, philHealth: true, pagIbig: true, tax: true };
export function computePayslip(dailyRate, logs, loanDeductions, frequency = 'semi-monthly', benefits = ALL) {
    const rate = Math.max(0, Number(dailyRate) || 0);
    const hourly = rate / 8;
    let daysWorked = 0, daysAbsent = 0, basic = 0, ot = 0, nd = 0, holiday = 0, late = 0, otherBenefits = 0;
    for (const l of logs) {
        const premium = DAY_PREMIUM[l.dayType] ?? 0;
        const mult = 1 + premium;
        const isHalfDay = l.status === 'Halfday' || l.status === 'Half Day';
        if (l.status === 'Present' || isHalfDay) {
            const workFraction = isHalfDay ? 0.5 : 1;
            daysWorked += workFraction;
            basic += rate * workFraction;
            holiday += rate * premium * workFraction;
            // Overtime is optional: pay by calculated hours or use a manually entered fixed amount.
            ot += l.overtimePayMode === 'Fixed Amount'
                ? Math.max(0, l.overtimeAmount || 0)
                : (l.overtimeHours || 0) * hourly * mult * (l.dayType === 'Regular Day' ? 1.25 : 1.3);
            nd += (l.nightDiffHours || 0) * hourly * mult * 0.1;
            late += ((l.lateMinutes || 0) / 60) * hourly;
            otherBenefits += Math.max(0, l.otherBenefit || 0);
        }
        else if (l.status === 'Paid Leave') {
            daysWorked += 1;
            basic += dailyRate;
        }
        else if (l.status === 'Absent') {
            daysAbsent += 1;
        }
        else if (l.dayType === 'Regular Holiday') {
            // Unworked regular holiday is still paid at 100%
            holiday += dailyRate;
        }
    }
    const monthly = dailyRate * 26;
    // Spread monthly statutory contributions across 52 weekly or 24 semi-monthly payroll periods.
    const div = frequency === 'weekly' ? 52 / 12 : 2;
    const sss = benefits.sss ? r2(sssEmployeeMonthly(monthly) / div) : 0;
    const philHealth = benefits.philHealth ? r2(philHealthEmployeeMonthly(monthly) / div) : 0;
    const pagIbig = benefits.pagIbig ? r2(pagIbigEmployeeMonthly(monthly) / div) : 0;
    const gross = r2(basic + ot + nd + holiday + otherBenefits - late);
    const taxable = Math.max(0, gross - sss - philHealth - pagIbig);
    const tax = !benefits.tax ? 0 : frequency === 'weekly' ? weeklyTax(taxable) : semiMonthlyTax(taxable);
    const net = r2(gross - sss - philHealth - pagIbig - tax - loanDeductions);
    return {
        daysWorked,
        daysAbsent,
        basicPay: r2(basic),
        overtimePay: r2(ot),
        otherBenefits: r2(otherBenefits),
        nightDiffPay: r2(nd),
        holidayPay: r2(holiday),
        lateDeduction: r2(late),
        grossPay: gross,
        sss,
        philHealth,
        pagIbig,
        withholdingTax: tax,
        loanDeductions: r2(loanDeductions),
        netPay: net,
    };
}
