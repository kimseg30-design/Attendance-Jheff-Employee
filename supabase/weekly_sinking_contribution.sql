-- Weekly Sinking Fund base contribution payroll linkage.
-- Safe to run in Supabase SQL Editor; existing member and payslip records are preserved.
alter table sf_members
  add column if not exists base_contribution numeric(12,2) not null default 0,
  add column if not exists employee_id uuid references employees(id) on delete set null;

alter table sf_members
  drop constraint if exists sf_members_base_contribution_nonnegative;
alter table sf_members
  add constraint sf_members_base_contribution_nonnegative check (base_contribution >= 0);

create index if not exists sf_members_employee_idx on sf_members(employee_id);

alter table payslips
  add column if not exists sinking_contribution_deduction numeric(12,2) not null default 0,
  add column if not exists other_benefits numeric(12,2) not null default 0;

-- Optional overtime mode and other-benefit fields on attendance records.
alter table attendance
  add column if not exists overtime_pay_mode text not null default 'Hours',
  add column if not exists overtime_amount numeric(12,2) not null default 0,
  add column if not exists other_benefit numeric(12,2) not null default 0;

-- Restrict overtime mode to supported choices and prevent negative amounts.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_overtime_pay_mode_valid') then
    alter table attendance add constraint attendance_overtime_pay_mode_valid check (overtime_pay_mode in ('Hours','Fixed Amount'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_overtime_amount_nonnegative') then
    alter table attendance add constraint attendance_overtime_amount_nonnegative check (overtime_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_other_benefit_nonnegative') then
    alter table attendance add constraint attendance_other_benefit_nonnegative check (other_benefit >= 0);
  end if;
end $$;

-- Keep the actual payroll date range on each Sinking Fund contribution ledger entry.
alter table sf_contributions
  add column if not exists payroll_period_start date,
  add column if not exists payroll_period_end date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sf_contributions_payroll_period_valid') then
    alter table sf_contributions add constraint sf_contributions_payroll_period_valid
      check (payroll_period_start is null or payroll_period_end is null or payroll_period_end >= payroll_period_start);
  end if;
end $$;
create index if not exists sf_contributions_payroll_period_idx
  on sf_contributions(payroll_period_start, payroll_period_end);
