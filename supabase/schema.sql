-- PH Attendance & Payroll — Supabase schema
-- Run this once in Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  department_name text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  employee_no text,
  position text,
  department_id uuid references departments(id) on delete set null,
  daily_rate numeric(12,2) default 0,
  employment_status text check (employment_status in ('Regular','Probationary','Contractual')),
  date_hired date,
  tin text,
  sss_no text,
  phil_health_no text,
  pag_ibig_no text,
  leave_credits numeric(6,1) default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  work_date date,
  employee_id uuid references employees(id) on delete cascade,
  time_in text,
  time_out text,
  status text check (status in ('Present','Halfday','Absent','Paid Leave','Rest Day')),
  day_type text check (day_type in ('Regular Day','Regular Holiday','Special Non-Working','Rest Day')),
  late_minutes numeric(8,0) default 0,
  overtime_hours numeric(6,2) default 0,
  overtime_pay_mode text not null default 'Hours' check (overtime_pay_mode in ('Hours','Fixed Amount')),
  overtime_amount numeric(12,2) not null default 0 check (overtime_amount >= 0),
  other_benefit numeric(12,2) not null default 0 check (other_benefit >= 0),
  night_diff_hours numeric(6,2) default 0,
  remarks text,
  created_at timestamptz not null default now()
);
-- Idempotent upgrades for databases created from an older schema.sql.
-- CREATE TABLE IF NOT EXISTS does not add new columns to an existing table.
alter table attendance
  add column if not exists overtime_pay_mode text not null default 'Hours',
  add column if not exists overtime_amount numeric(12,2) not null default 0,
  add column if not exists other_benefit numeric(12,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_overtime_pay_mode_valid') then
    alter table attendance add constraint attendance_overtime_pay_mode_valid
      check (overtime_pay_mode in ('Hours','Fixed Amount'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_overtime_amount_nonnegative') then
    alter table attendance add constraint attendance_overtime_amount_nonnegative check (overtime_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_other_benefit_nonnegative') then
    alter table attendance add constraint attendance_other_benefit_nonnegative check (other_benefit >= 0);
  end if;
  alter table public.attendance drop constraint if exists attendance_status_check;
  alter table public.attendance
    add constraint attendance_status_check
    check (status in ('Present','Halfday','Absent','Paid Leave','Rest Day'));
end $$;

create index if not exists attendance_work_date_idx on attendance(work_date);
create index if not exists attendance_employee_idx on attendance(employee_id);

create table if not exists leaves (
  id uuid primary key default gen_random_uuid(),
  leave_reason text,
  employee_id uuid references employees(id) on delete cascade,
  leave_type text check (leave_type in ('Vacation Leave','Sick Leave','Maternity/Paternity','Leave Without Pay')),
  start_date date,
  end_date date,
  days numeric(6,1),
  status text default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamptz not null default now()
);

create table if not exists cash_advances (
  id uuid primary key default gen_random_uuid(),
  description text,
  employee_id uuid references employees(id) on delete cascade,
  type text check (type in ('Cash Advance','SSS Loan','Pag-IBIG Loan','Company Loan')),
  amount numeric(12,2) default 0,
  deduction_per_cutoff numeric(12,2) default 0,
  balance numeric(12,2) default 0,
  date_granted date,
  status text default 'Active' check (status in ('Active','Paid')),
  created_at timestamptz not null default now()
);

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  period_label text,
  employee_id uuid references employees(id) on delete cascade,
  period_start date,
  period_end date,
  days_worked numeric(6,1) default 0,
  basic_pay numeric(12,2) default 0,
  overtime_pay numeric(12,2) default 0,
  other_benefits numeric(12,2) not null default 0,
  night_diff_pay numeric(12,2) default 0,
  holiday_pay numeric(12,2) default 0,
  late_deduction numeric(12,2) default 0,
  gross_pay numeric(12,2) default 0,
  sss numeric(12,2) default 0,
  phil_health numeric(12,2) default 0,
  pag_ibig numeric(12,2) default 0,
  withholding_tax numeric(12,2) default 0,
  loan_deductions numeric(12,2) default 0,
  cash_advance_deduction numeric(12,2) default 0,
  sinking_contribution_deduction numeric(12,2) not null default 0,
  net_pay numeric(12,2) default 0,
  status text default 'Draft' check (status in ('Draft','Released')),
  deduction_details text,
  created_at timestamptz not null default now()
);
-- Idempotent upgrade for existing payroll tables.
alter table payslips
  add column if not exists other_benefits numeric(12,2) not null default 0,
  add column if not exists sinking_contribution_deduction numeric(12,2) not null default 0;

create index if not exists payslips_period_idx on payslips(period_start, period_end);

-- Dashboard stats in one call
create or replace function get_dashboard()
returns json language sql stable as $$
  select json_build_object(
    'activeEmployees', (select count(*) from employees where active),
    'presentToday', (select count(*) from attendance where work_date = (now() at time zone 'Asia/Manila')::date and status in ('Present','Paid Leave')),
    'halfdayToday', (select count(*) from attendance where work_date = (now() at time zone 'Asia/Manila')::date and status in ('Halfday','Half Day')),
    'restDayToday', (select count(*) from attendance where work_date = (now() at time zone 'Asia/Manila')::date and (status = 'Rest Day' or day_type = 'Rest Day')),
    'absentToday', (select count(*) from attendance where work_date = (now() at time zone 'Asia/Manila')::date and status = 'Absent'),
    'pendingLeaves', (select count(*) from leaves where status = 'Pending'),
    'outstandingLoans', (select coalesce(sum(balance),0) from cash_advances where status = 'Active'),
    'outstandingCashAdvance', (select coalesce(sum(balance),0) from cash_advances where status = 'Active'),
    'lastPayroll', (select json_build_object('label', period_label, 'total', sum(net_pay)) from payslips
                    group by period_label, period_end order by period_end desc nulls last limit 1),
    'attendanceByDay', coalesce((select json_agg(x order by x.date) from (
        select to_char(work_date,'YYYY-MM-DD') as date,
          count(*) filter (where status in ('Present','Paid Leave')) as present,
          count(*) filter (where status in ('Halfday','Half Day')) as halfday,
          count(*) filter (where status = 'Rest Day' or day_type = 'Rest Day') as rest_day,
          count(*) filter (where status = 'Absent') as absent
        from attendance where work_date >= (now() at time zone 'Asia/Manila')::date - 14 group by 1) x), '[]'::json),
    'byDepartment', coalesce((select json_agg(y order by y.count desc) from (
        select coalesce(d.department_name,'Unassigned') as name, count(e.id) as count
        from employees e left join departments d on d.id = e.department_id
        where e.active group by 1) y), '[]'::json)
  );
$$;

-- Secure-by-default RLS: the browser must never query these tables directly.
-- Keep SUPABASE_SERVICE_ROLE_KEY as a server-only Supabase service_role/secret key.
do $$
declare t text;
begin
  foreach t in array array['departments','employees','attendance','leaves','cash_advances','payslips'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_full_access on public.%I', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on function public.get_dashboard() from public, anon, authenticated;
grant execute on function public.get_dashboard() to service_role;
