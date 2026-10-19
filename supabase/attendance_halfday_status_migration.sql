-- PH Attendance & Payroll: allow Halfday attendance status.
-- Run in Supabase SQL Editor. Safe to re-run; existing attendance records are preserved.
begin;
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('Present','Halfday','Absent','Paid Leave'));
commit;
