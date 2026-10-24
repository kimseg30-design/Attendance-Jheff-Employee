// Philippine BIR Tax & Deadline Engine
// Implements TRAIN Law withholding tax tables, flexible benefit handling, MWE rules, De Minimis thresholds, and dynamic holiday/weekend shifting.

// Standard Philippine statutory minimum wage guideline (NCR/Region IV-A reference ~610–645 PHP/day)
export const STATUTORY_MINIMUM_WAGE_DAILY = 645;
export const STATUTORY_BONUS_EXEMPT_LIMIT = 90000;

// Standard Philippine regular and special national holidays (fixed dates)
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 1, day: 2, name: 'Special Non-Working Holiday' },
  { month: 2, day: 25, name: 'EDSA People Power Revolution Anniversary' },
  { month: 4, day: 9, name: 'Araw ng Kagitingan' },
  { month: 5, day: 1, name: 'Labor Day' },
  { month: 6, day: 12, name: 'Independence Day' },
  { month: 8, day: 21, name: 'Ninoy Aquino Day' },
  { month: 11, day: 1, name: "All Saints' Day" },
  { month: 11, day: 2, name: "All Souls' Day" },
  { month: 11, day: 30, name: 'Bonifacio Day' },
  { month: 12, day: 8, name: 'Feast of the Immaculate Conception' },
  { month: 12, day: 24, name: 'Christmas Eve' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 30, name: 'Rizal Day' },
  { month: 12, day: 31, name: 'Last Day of the Year' },
];

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function getPhilippineHolidays(year) {
  const holidays = FIXED_HOLIDAYS.map((h) => ({
    dateStr: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
    name: h.name,
  }));

  // Movable Holy Week holidays (Maundy Thursday, Good Friday, Black Saturday)
  const easter = getEasterDate(year);
  const addDays = (d, days) => {
    const res = new Date(d);
    res.setUTCDate(res.getUTCDate() + days);
    return res.toISOString().slice(0, 10);
  };

  holidays.push({ dateStr: addDays(easter, -3), name: 'Maundy Thursday' });
  holidays.push({ dateStr: addDays(easter, -2), name: 'Good Friday' });
  holidays.push({ dateStr: addDays(easter, -1), name: 'Black Saturday' });

  // National Heroes Day: Last Monday of August
  const aug31 = new Date(Date.UTC(year, 7, 31));
  const dayOfWeek = aug31.getUTCDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const lastMonAug = new Date(Date.UTC(year, 7, 31 - diffToMonday));
  holidays.push({ dateStr: lastMonAug.toISOString().slice(0, 10), name: 'National Heroes Day' });

  return holidays;
}

export function isHoliday(dateObj, holidayMap) {
  const str = dateObj.toISOString().slice(0, 10);
  return holidayMap.get(str) || null;
}

export function adjustForWeekendAndHoliday(targetDate) {
  const cur = new Date(targetDate);
  const year = cur.getUTCFullYear();
  const holidays = getPhilippineHolidays(year);
  if (cur.getUTCMonth() === 11) {
    holidays.push(...getPhilippineHolidays(year + 1));
  }
  const holidayMap = new Map(holidays.map((h) => [h.dateStr, h.name]));

  const origDay = cur.getUTCDay();
  const origDateStr = cur.toISOString().slice(0, 10);
  let shifted = false;
  let reasons = [];

  while (true) {
    const day = cur.getUTCDay();
    const hol = isHoliday(cur, holidayMap);

    if (day === 0) {
      shifted = true;
      reasons.push('Sunday');
      cur.setUTCDate(cur.getUTCDate() + 1);
    } else if (day === 6) {
      shifted = true;
      reasons.push('Saturday');
      cur.setUTCDate(cur.getUTCDate() + 2);
    } else if (hol) {
      shifted = true;
      reasons.push(`${hol}`);
      cur.setUTCDate(cur.getUTCDate() + 1);
    } else {
      break;
    }
  }

  const finalDateStr = cur.toISOString().slice(0, 10);
  return {
    originalDate: origDateStr,
    effectiveDate: finalDateStr,
    wasShifted: shifted,
    shiftReason: shifted ? reasons.join(' & ') : null,
    dayName: cur.toLocaleDateString('en-PH', { weekday: 'long', timeZone: 'Asia/Manila' }),
  };
}

// Calculate upcoming deadlines dynamically relative to referenceDate
export function getBirDeadlines(referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const curYear = ref.getUTCFullYear();
  const curMonth = ref.getUTCMonth(); // 0-indexed (0 = Jan, 9 = Oct)

  // 1. Monthly BIR Form 1601-C:
  // Due on the 10th day of the following month for the covered period.
  let target1601CMonth = curMonth + 1;
  let target1601CYear = curYear;
  if (ref.getUTCDate() > 10) {
    target1601CMonth = curMonth + 1;
  } else {
    target1601CMonth = curMonth;
  }
  if (target1601CMonth > 11) {
    target1601CMonth = 0;
    target1601CYear += 1;
  }

  const raw1601C = new Date(Date.UTC(target1601CYear, target1601CMonth, 10));
  const adj1601C = adjustForWeekendAndHoliday(raw1601C);

  // Covered period for this upcoming 1601-C is the preceding month
  const prevMonthIndex = (target1601CMonth + 11) % 12;
  const prevMonthYear = target1601CMonth === 0 ? target1601CYear - 1 : target1601CYear;
  const coveredMonthName = new Date(Date.UTC(prevMonthYear, prevMonthIndex, 1)).toLocaleString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });

  // 2. Quarterly BIR Form 1601-EQ / 1603Q:
  // Due on the last day of the month following the close of the quarter:
  const quarters = [
    { name: 'Q1 (Jan–Mar)', closeYear: curYear, dueMonth: 3, dueDay: 30, dueYear: curYear }, // Apr 30
    { name: 'Q2 (Apr–Jun)', closeYear: curYear, dueMonth: 6, dueDay: 31, dueYear: curYear }, // Jul 31
    { name: 'Q3 (Jul–Sep)', closeYear: curYear, dueMonth: 9, dueDay: 31, dueYear: curYear }, // Oct 31
    { name: 'Q4 (Oct–Dec)', closeYear: curYear, dueMonth: 0, dueDay: 31, dueYear: curYear + 1 }, // Jan 31
  ];

  let nextQ = quarters.find((q) => {
    const raw = new Date(Date.UTC(q.dueYear, q.dueMonth, q.dueDay, 23, 59, 59));
    return raw >= ref;
  });
  if (!nextQ) {
    nextQ = { name: 'Q1 (Jan–Mar)', closeYear: curYear + 1, dueMonth: 3, dueDay: 30, dueYear: curYear + 1 };
  }
  const raw1601EQ = new Date(Date.UTC(nextQ.dueYear, nextQ.dueMonth, nextQ.dueDay));
  const adj1601EQ = adjustForWeekendAndHoliday(raw1601EQ);

  // 3. Annually BIR Form 1604-C & Alphalist / Form 2316:
  // Due on or before January 31 of the following calendar year.
  let targetAnnualYear = curYear + 1;
  const raw1604C = new Date(Date.UTC(targetAnnualYear, 0, 31));
  const adj1604C = adjustForWeekendAndHoliday(raw1604C);

  const getDaysDiff = (dStr) => {
    const target = new Date(dStr + 'T23:59:59Z');
    const msDiff = target.getTime() - ref.getTime();
    return Math.ceil(msDiff / (1000 * 60 * 60 * 24));
  };

  return [
    {
      form: 'BIR Form 1601-C',
      title: 'Monthly Remittance Return of Income Taxes Withheld on Compensation',
      frequency: 'Monthly',
      periodCovered: coveredMonthName,
      statutoryRule: 'Due on the 10th day of the month following the payroll period',
      originalDate: adj1601C.originalDate,
      effectiveDate: adj1601C.effectiveDate,
      dayName: adj1601C.dayName,
      wasShifted: adj1601C.wasShifted,
      shiftReason: adj1601C.shiftReason,
      daysRemaining: getDaysDiff(adj1601C.effectiveDate),
      urgency: getDaysDiff(adj1601C.effectiveDate) <= 5 ? 'critical' : getDaysDiff(adj1601C.effectiveDate) <= 15 ? 'warning' : 'normal',
    },
    {
      form: 'BIR Form 1601-EQ / 1603Q',
      title: 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Compensation / Expanded)',
      frequency: 'Quarterly',
      periodCovered: nextQ.name,
      statutoryRule: 'Due on the last day of the month following the close of the quarter',
      originalDate: adj1601EQ.originalDate,
      effectiveDate: adj1601EQ.effectiveDate,
      dayName: adj1601EQ.dayName,
      wasShifted: adj1601EQ.wasShifted,
      shiftReason: adj1601EQ.shiftReason,
      daysRemaining: getDaysDiff(adj1601EQ.effectiveDate),
      urgency: getDaysDiff(adj1601EQ.effectiveDate) <= 7 ? 'critical' : getDaysDiff(adj1601EQ.effectiveDate) <= 20 ? 'warning' : 'normal',
    },
    {
      form: 'BIR Form 1604-C & Alphalist',
      title: 'Annual Information Return of Income Taxes Withheld on Compensation & Form 2316 Certificates',
      frequency: 'Annually',
      periodCovered: `Calendar Year ${curYear}`,
      statutoryRule: 'Due on or before January 31 of the following calendar year',
      originalDate: adj1604C.originalDate,
      effectiveDate: adj1604C.effectiveDate,
      dayName: adj1604C.dayName,
      wasShifted: adj1604C.wasShifted,
      shiftReason: adj1604C.shiftReason,
      daysRemaining: getDaysDiff(adj1604C.effectiveDate),
      urgency: getDaysDiff(adj1604C.effectiveDate) <= 10 ? 'critical' : getDaysDiff(adj1604C.effectiveDate) <= 30 ? 'warning' : 'normal',
    },
  ];
}

// Revised Withholding Tax Table (TRAIN Law: Monthly & Semi-Monthly)
export function computeMonthlyWithholdingTax(taxableIncome) {
  if (taxableIncome <= 20833.33) return 0;
  if (taxableIncome <= 33333.33) return Math.round((taxableIncome - 20833.33) * 0.15 * 100) / 100;
  if (taxableIncome <= 66666.67) return Math.round((1875 + (taxableIncome - 33333.33) * 0.20) * 100) / 100;
  if (taxableIncome <= 166666.67) return Math.round((8541.67 + (taxableIncome - 66666.67) * 0.25) * 100) / 100;
  if (taxableIncome <= 666666.67) return Math.round((33541.67 + (taxableIncome - 166666.67) * 0.30) * 100) / 100;
  return Math.round((183541.67 + (taxableIncome - 666666.67) * 0.35) * 100) / 100;
}

export function computeSemiMonthlyWithholdingTax(taxableIncome) {
  if (taxableIncome <= 10417) return 0;
  if (taxableIncome <= 16667) return Math.round((taxableIncome - 10417) * 0.15 * 100) / 100;
  if (taxableIncome <= 33333) return Math.round((937.5 + (taxableIncome - 16667) * 0.20) * 100) / 100;
  if (taxableIncome <= 83333) return Math.round((4270.83 + (taxableIncome - 33333) * 0.25) * 100) / 100;
  if (taxableIncome <= 333333) return Math.round((16770.83 + (taxableIncome - 83333) * 0.30) * 100) / 100;
  return Math.round((91770.83 + (taxableIncome - 333333) * 0.35) * 100) / 100;
}

// Check if an employee qualifies as Minimum Wage Earner (MWE)
// Republic Act No. 9504: Minimum Wage Earners are exempt from income tax on basic, overtime, night shift diff, holiday & hazard pay.
export function isMinimumWageEarner(employee) {
  if (employee.isMwe === true || employee.isMwe === 'true' || employee.isMwe === 1) return true;
  const dailyRate = Number(employee.dailyRate || 0);
  if (dailyRate > 0 && dailyRate <= STATUTORY_MINIMUM_WAGE_DAILY) return true;
  const monthlySalary = Number(employee.monthlySalary || 0);
  if (monthlySalary > 0 && monthlySalary <= STATUTORY_MINIMUM_WAGE_DAILY * 26) return true;
  return false;
}

// Flexible Tax & Benefit Calculation
export function analyzePayrollTaxData(payslips = [], employeesMap = {}) {
  let totalGross = 0;
  let totalTaxable = 0;
  let totalNonTaxableExempt = 0;
  let totalTaxWithheld = 0;
  let totalSss = 0;
  let totalPhilHealth = 0;
  let totalPagIbig = 0;

  let mweCount = 0;
  let regularCount = 0;
  let mweTotalCompensation = 0;
  let mweBasic = 0;
  let mweHoliday = 0;
  let mweOt = 0;
  let mweNightDiff = 0;

  let totalDeMinimis = 0;
  let totalBonuses = 0;
  let excessBonusTaxable = 0;

  const employeeSummaries = new Map();

  for (const p of payslips) {
    const empId = Array.isArray(p.employee) ? p.employee[0] : p.employee || p.employeeId;
    const emp = employeesMap[empId] || { fullName: p.employeeName || 'Employee' };
    const isMwe = isMinimumWageEarner(emp);

    const gross = Number(p.grossPay || 0);
    const sss = Number(p.sss || 0);
    const ph = Number(p.philHealth || 0);
    const pi = Number(p.pagIbig || 0);
    const statutoryDeductions = sss + ph + pi;

    const basic = Number(p.basicPay || 0);
    const ot = Number(p.overtimePay || 0);
    const holiday = Number(p.holidayPay || 0);
    const nightDiff = Number(p.nightDiffPay || 0);
    const deMinimis = Number(p.deMinimis || p.otherBenefits || 0);
    const bonus = Number(p.bonus || p.thirteenthMonth || 0);

    totalGross += gross;
    totalSss += sss;
    totalPhilHealth += ph;
    totalPagIbig += pi;
    totalDeMinimis += deMinimis;
    totalBonuses += bonus;

    let computedTax = Number(p.withholdingTax || 0);

    if (isMwe) {
      mweCount++;
      mweTotalCompensation += gross;
      mweBasic += basic;
      mweHoliday += holiday;
      mweOt += ot;
      mweNightDiff += nightDiff;
      totalNonTaxableExempt += gross;
      // Minimum Wage Earners are 100% tax exempt on basic + OT + holiday + night diff
      computedTax = 0;
    } else {
      regularCount++;
      // Flexible benefit handling:
      // If statutory contributions are PRESENT: deduct from Gross to determine Taxable base.
      // If ABSENT or ZERO: proceed without throwing error; Taxable base = Gross - De Minimis.
      const exemptPortion = statutoryDeductions + deMinimis;
      const taxablePortion = Math.max(0, gross - exemptPortion);
      totalNonTaxableExempt += exemptPortion;
      totalTaxable += taxablePortion;

      // If withholding tax is not explicitly provided, calculate using BIR revised withholding tax table
      if (p.withholdingTax === undefined || p.withholdingTax === null || isNaN(p.withholdingTax)) {
        computedTax = computeSemiMonthlyWithholdingTax(taxablePortion);
      }
    }

    totalTaxWithheld += computedTax;

    const cur = employeeSummaries.get(empId) || {
      id: empId,
      name: emp.fullName || p.employeeName || 'Employee',
      isMwe,
      gross: 0,
      nonTaxable: 0,
      taxable: 0,
      taxWithheld: 0,
      sss: 0,
      philHealth: 0,
      pagIbig: 0,
    };
    cur.gross += gross;
    cur.sss += sss;
    cur.philHealth += ph;
    cur.pagIbig += pi;
    cur.taxWithheld += computedTax;
    if (isMwe) {
      cur.nonTaxable += gross;
    } else {
      const ex = statutoryDeductions + deMinimis;
      cur.nonTaxable += ex;
      cur.taxable += Math.max(0, gross - ex);
    }
    employeeSummaries.set(empId, cur);
  }

  // Bonus 90,000 threshold verification
  if (totalBonuses > STATUTORY_BONUS_EXEMPT_LIMIT) {
    excessBonusTaxable = totalBonuses - STATUTORY_BONUS_EXEMPT_LIMIT;
    totalTaxable += excessBonusTaxable;
    totalNonTaxableExempt -= excessBonusTaxable;
  }

  const totalMandatoryBenefits = totalSss + totalPhilHealth + totalPagIbig;
  const hasZeroOrMissingBenefits = totalMandatoryBenefits === 0 && regularCount > 0;

  return {
    totalGrossCompensation: Math.round(totalGross * 100) / 100,
    totalNonTaxableExempt: Math.round(totalNonTaxableExempt * 100) / 100,
    totalTaxableCompensation: Math.round(totalTaxable * 100) / 100,
    totalTaxWithheld: Math.round(totalTaxWithheld * 100) / 100,
    statutoryContributions: {
      sss: Math.round(totalSss * 100) / 100,
      philHealth: Math.round(totalPhilHealth * 100) / 100,
      pagIbig: Math.round(totalPagIbig * 100) / 100,
      total: Math.round(totalMandatoryBenefits * 100) / 100,
      hasContributions: totalMandatoryBenefits > 0,
    },
    noBenefitsWarning: hasZeroOrMissingBenefits
      ? {
          triggered: true,
          messageEn:
            'No mandatory employee benefits contributions (SSS, PhilHealth, Pag-IBIG) were provided in this payroll period. As a result, the taxable compensation base and resulting BIR withholding taxes are higher because no tax-exempt government premium deductions were applied.',
          messageTl:
            'Paalala: Walang nakatalang mandatory contributions (SSS, PhilHealth, Pag-IBIG) sa payroll na ito. Dahil dito, mas mataas ang Taxable Compensation at ang kaukulang BIR Withholding Tax dahil walang naibawas na tax-exempt government contributions.',
        }
      : null,
    mweBreakdown: {
      count: mweCount,
      totalCompensation: Math.round(mweTotalCompensation * 100) / 100,
      basicPay: Math.round(mweBasic * 100) / 100,
      holidayPay: Math.round(mweHoliday * 100) / 100,
      overtimePay: Math.round(mweOt * 100) / 100,
      nightDiffPay: Math.round(mweNightDiff * 100) / 100,
      isExempt: true,
    },
    regularEarners: {
      count: regularCount,
      taxableCompensation: Math.round(totalTaxable * 100) / 100,
      taxWithheld: Math.round(totalTaxWithheld * 100) / 100,
    },
    deMinimisAndBonuses: {
      totalDeMinimis: Math.round(totalDeMinimis * 100) / 100,
      totalBonuses: Math.round(totalBonuses * 100) / 100,
      bonusExemptionThreshold: STATUTORY_BONUS_EXEMPT_LIMIT,
      excessBonusTaxable: Math.round(excessBonusTaxable * 100) / 100,
    },
    employeeCount: employeeSummaries.size,
    employeesList: Array.from(employeeSummaries.values()),
  };
}
