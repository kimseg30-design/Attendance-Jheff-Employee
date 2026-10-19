// In-memory store providing local mock data and database operations
// when Supabase is not connected or in AI Studio dev sandbox.

function phDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
}

function subDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const dept1 = 'd1111111-1111-1111-1111-111111111111';
const dept2 = 'd2222222-2222-2222-2222-222222222222';
const dept3 = 'd3333333-3333-3333-3333-333333333333';
const dept4 = 'd4444444-4444-4444-4444-444444444444';

const emp1 = 'e1111111-1111-1111-1111-111111111111';
const emp2 = 'e2222222-2222-2222-2222-222222222222';
const emp3 = 'e3333333-3333-3333-3333-333333333333';
const emp4 = 'e4444444-4444-4444-4444-444444444444';

const today = phDateString();

const initialDepartments = [
  { id: dept1, departmentName: 'Operations', description: 'Core business and facilities operations', createdAt: '2023-01-01T00:00:00.000Z' },
  { id: dept2, departmentName: 'Accounting & Finance', description: 'Financial management, payroll, and auditing', createdAt: '2023-01-01T00:00:00.000Z' },
  { id: dept3, departmentName: 'Human Resources', description: 'Talent management, employee relations, and benefits', createdAt: '2023-01-01T00:00:00.000Z' },
  { id: dept4, departmentName: 'Information Technology', description: 'IT systems, security, and internal software', createdAt: '2023-01-01T00:00:00.000Z' },
];

const initialEmployees = [
  {
    id: emp1,
    fullName: 'Juan Dela Cruz',
    employeeNo: 'EMP-001',
    position: 'Senior Systems Engineer',
    department: [dept4],
    dailyRate: 1200,
    employmentStatus: 'Regular',
    dateHired: '2023-01-15',
    tin: '123-456-789-000',
    sssNo: '03-1234567-8',
    philHealthNo: '12-345678901-2',
    pagIbigNo: '1234-5678-9012',
    leaveCredits: 15,
    active: true,
    createdAt: '2023-01-15T00:00:00.000Z',
  },
  {
    id: emp2,
    fullName: 'Maria Santos',
    employeeNo: 'EMP-002',
    position: 'Payroll Specialist',
    department: [dept2],
    dailyRate: 950,
    employmentStatus: 'Regular',
    dateHired: '2023-03-01',
    tin: '234-567-890-000',
    sssNo: '03-2345678-9',
    philHealthNo: '12-456789012-3',
    pagIbigNo: '2345-6789-0123',
    leaveCredits: 12,
    active: true,
    createdAt: '2023-03-01T00:00:00.000Z',
  },
  {
    id: emp3,
    fullName: 'Pedro Penduko',
    employeeNo: 'EMP-003',
    position: 'Operations Supervisor',
    department: [dept1],
    dailyRate: 850,
    employmentStatus: 'Regular',
    dateHired: '2023-06-10',
    tin: '345-678-901-000',
    sssNo: '03-3456789-0',
    philHealthNo: '12-567890123-4',
    pagIbigNo: '3456-7890-1234',
    leaveCredits: 10,
    active: true,
    createdAt: '2023-06-10T00:00:00.000Z',
  },
  {
    id: emp4,
    fullName: 'Ana Reyes',
    employeeNo: 'EMP-004',
    position: 'HR Assistant',
    department: [dept3],
    dailyRate: 750,
    employmentStatus: 'Probationary',
    dateHired: '2024-02-01',
    tin: '456-789-012-000',
    sssNo: '03-4567890-1',
    philHealthNo: '12-678901234-5',
    pagIbigNo: '4567-8901-2345',
    leaveCredits: 5,
    active: true,
    createdAt: '2024-02-01T00:00:00.000Z',
  },
];

// Generate attendance for past 14 days
const initialAttendance = [];
for (let i = 13; i >= 0; i--) {
  const dStr = subDays(today, i);
  const dayOfWeek = new Date(dStr).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dayType = isWeekend ? 'Rest Day' : 'Regular Day';

  for (const emp of initialEmployees) {
    initialAttendance.push({
      id: crypto.randomUUID(),
      employee: [emp.id],
      workDate: dStr,
      timeIn: isWeekend ? null : '08:00',
      timeOut: isWeekend ? null : '17:00',
      status: isWeekend ? 'Rest Day' : 'Present',
      dayType,
      lateMinutes: 0,
      overtimeHours: 0,
      overtimePayMode: 'Hours',
      overtimeAmount: 0,
      otherBenefit: 0,
      nightDiffHours: 0,
      remarks: '',
      createdAt: `${dStr}T08:00:00.000Z`,
    });
  }
}

const initialLeaves = [
  {
    id: crypto.randomUUID(),
    employee: [emp2],
    leaveReason: 'Annual Family Vacation',
    leaveType: 'Vacation Leave',
    startDate: subDays(today, -5),
    endDate: subDays(today, -7),
    days: 3,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  },
];

const initialCashAdvances = [
  {
    id: crypto.randomUUID(),
    employee: [emp1],
    description: 'Emergency Medical Assistance',
    type: 'Company Loan',
    amount: 15000,
    deductionPerCutoff: 1500,
    balance: 10500,
    dateGranted: subDays(today, 30),
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
];

const initialPayslips = [
  {
    id: crypto.randomUUID(),
    employee: [emp1],
    periodLabel: 'Sept 16 - Sept 30, 2024',
    periodStart: subDays(today, 30),
    periodEnd: subDays(today, 16),
    daysWorked: 11,
    basicPay: 13200,
    overtimePay: 0,
    otherBenefits: 1000,
    nightDiffPay: 0,
    holidayPay: 0,
    lateDeduction: 0,
    grossPay: 14200,
    sss: 580,
    philHealth: 250,
    pagIbig: 100,
    withholdingTax: 320,
    loanDeductions: 1500,
    cashAdvanceDeduction: 0,
    sinkingContributionDeduction: 200,
    netPay: 11450,
    status: 'Released',
    deductionDetails: 'SSS: 580, PhilHealth: 250, Pag-IBIG: 100, Sinking Fund: 200',
    createdAt: new Date().toISOString(),
  },
];

const sfMember1 = crypto.randomUUID();
const sfMember2 = crypto.randomUUID();

const initialSfMembers = [
  {
    id: sfMember1,
    fullName: 'Juan Dela Cruz',
    contactNo: '0917-123-4567',
    email: 'juan@example.com',
    status: 'Active',
    employeeId: emp1,
    baseContribution: 200,
    joinedOn: '2023-01-20',
    notes: 'Founding member',
    createdAt: '2023-01-20T00:00:00.000Z',
  },
  {
    id: sfMember2,
    fullName: 'Maria Santos',
    contactNo: '0918-234-5678',
    email: 'maria@example.com',
    status: 'Active',
    employeeId: emp2,
    baseContribution: 200,
    joinedOn: '2023-03-05',
    notes: '',
    createdAt: '2023-03-05T00:00:00.000Z',
  },
];

const initialSfSettings = {
  id: 1,
  defaultMonthlyRate: 5,
  defaultPenaltyRate: 2,
  graceDays: 3,
  baseContribution: 200,
};

const initialSfContributions = [
  {
    id: crypto.randomUUID(),
    memberId: sfMember1,
    amount: 1000,
    contributedOn: subDays(today, 15),
    reference_no: 'SF-CONT-001',
    payroll_period_start: subDays(today, 30),
    payroll_period_end: subDays(today, 16),
    notes: 'Monthly contribution',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    memberId: sfMember2,
    amount: 1000,
    contributedOn: subDays(today, 15),
    reference_no: 'SF-CONT-002',
    payroll_period_start: subDays(today, 30),
    payroll_period_end: subDays(today, 16),
    notes: 'Monthly contribution',
    createdAt: new Date().toISOString(),
  },
];

const sfLoan1 = crypto.randomUUID();
const initialSfLoans = [
  {
    id: sfLoan1,
    borrowerName: 'Juan Dela Cruz',
    contactNo: '0917-123-4567',
    address: 'Metro Manila, Philippines',
    loanGroup: '1st Group',
    loanType: 'New Loan',
    principal: 20000,
    monthlyRate: 5,
    termMonths: 4,
    frequency: 'Monthly',
    penaltyRate: 2,
    graceDays: 3,
    startDate: subDays(today, 45),
    firstDueDate: subDays(today, 15),
    earlySettlement: false,
    declaredPrincipal: 20000,
    declaredAt: subDays(today, 45),
    purpose: 'Home Improvement',
    createdAt: new Date().toISOString(),
  },
];

const initialSfPayments = [
  {
    id: crypto.randomUUID(),
    loanId: sfLoan1,
    amount: 6000,
    paidAt: subDays(today, 14),
    type: 'Regular Payment',
    notes: 'First installment',
    createdAt: new Date().toISOString(),
  },
];

const initialUserRoles = [
  { id: crypto.randomUUID(), user: 'usr_admin', label: 'kimsegarra4@gmail.com', role: 'Admin', createdAt: new Date().toISOString() },
  { id: crypto.randomUUID(), user: 'usr_admin_orig', label: 'kimsegarra516@gmail.com', role: 'Admin', createdAt: new Date().toISOString() },
];

export const memoryDb = {
  departments: [...initialDepartments],
  employees: [...initialEmployees],
  attendance: [...initialAttendance],
  leaves: [...initialLeaves],
  cashAdvances: [...initialCashAdvances],
  payslips: [...initialPayslips],
  sf_members: [...initialSfMembers],
  sf_contributions: [...initialSfContributions],
  sf_loans: [...initialSfLoans],
  sf_payments: [...initialSfPayments],
  sf_balance_declarations: [],
  sf_audit_log: [],
  sf_settings: [initialSfSettings],
  app_user_roles: [...initialUserRoles],
  app_invites: [],
  app_rate_limit_buckets: [],
  app_failed_actions: [],
};

export function getTableRecords(table) {
  const norm = table === 'cash_advances' ? 'cashAdvances' : table;
  return memoryDb[norm] || [];
}

export function setTableRecords(table, records) {
  const norm = table === 'cash_advances' ? 'cashAdvances' : table;
  memoryDb[norm] = records;
}

export function computeMockDashboard() {
  const activeEmps = memoryDb.employees.filter((e) => e.active).length;
  const todayAtt = memoryDb.attendance.filter((a) => a.workDate === today);
  const presentToday = todayAtt.filter((a) => ['Present', 'Halfday', 'Paid Leave'].includes(a.status)).length;
  const absentToday = todayAtt.filter((a) => a.status === 'Absent').length;
  const pendingLeaves = memoryDb.leaves.filter((l) => l.status === 'Pending').length;
  const outstandingLoans = memoryDb.cashAdvances.filter((c) => c.status === 'Active').reduce((s, c) => s + Number(c.balance || 0), 0);

  const deptCounts = {};
  for (const emp of memoryDb.employees) {
    if (!emp.active) continue;
    const deptId = Array.isArray(emp.department) ? emp.department[0] : emp.department;
    const dept = memoryDb.departments.find((d) => d.id === deptId);
    const dName = dept ? dept.departmentName : 'Unassigned';
    deptCounts[dName] = (deptCounts[dName] || 0) + 1;
  }
  const byDepartment = Object.entries(deptCounts).map(([name, count]) => ({ name, count }));

  return {
    activeEmployees: activeEmps,
    presentToday,
    absentToday,
    pendingLeaves,
    outstandingLoans,
    lastPayroll: memoryDb.payslips[0] ? { label: memoryDb.payslips[0].periodLabel, total: memoryDb.payslips.reduce((a, b) => a + Number(b.netPay || 0), 0) } : null,
    byDepartment,
  };
}
