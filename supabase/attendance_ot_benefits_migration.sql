-- PH Attendance & Payroll: fix OT Amount and Other Benefits fields.
-- Paste into Supabase SQL Editor and Run. Safe to re-run; existing records are preserved.

begin;

-- Attendance fields used by the Attendance edit dialog.
alter table public.attendance
  add column if not exists overtime_pay_mode text not null default 'Hours',
  add column if not exists overtime_amount numeric(12,2) not null default 0,
  add column if not exists other_benefit numeric(12,2) not null default 0;

-- Keep the database status constraint aligned with the Halfday option in the app.
-- Existing attendance rows are preserved; only the accepted status values change.
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check
  check (status in ('Present','Halfday','Absent','Paid Leave'));

-- Validate supported OT modes and non-negative peso amounts.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_overtime_pay_mode_valid') then
    alter table public.attendance add constraint attendance_overtime_pay_mode_valid
      check (overtime_pay_mode in ('Hours','Fixed Amount'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_overtime_amount_nonnegative') then
    alter table public.attendance add constraint attendance_overtime_amount_nonnegative check (overtime_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_other_benefit_nonnegative') then
    alter table public.attendance add constraint attendance_other_benefit_nonnegative check (other_benefit >= 0);
  end if;
end $$;

-- Payroll/payslip fields receiving calculated amounts from attendance.
alter table public.payslips
  add column if not exists other_benefits numeric(12,2) not null default 0,
  add column if not exists sinking_contribution_deduction numeric(12,2) not null default 0;

commit;
