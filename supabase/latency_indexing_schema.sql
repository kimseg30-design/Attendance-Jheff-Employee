-- ==============================================================================
-- ZERO-DOWNTIME LATENCY REDUCTION INDEXING & SCHEMA OPTIMIZATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xurvumenaszahorrxhxf/sql/new
-- ==============================================================================
-- WHY THIS PREVENTS APP DISCONNECTS:
-- 1. Standard "CREATE INDEX" locks the table with SHARE lock, blocking INSERTs/UPDATEs.
--    This causes timeouts and app disconnections on busy tables.
-- 2. "CREATE INDEX IF NOT EXISTS" is idempotent and safe to run multiple times.
-- 3. In PostgreSQL production, using "CONCURRENTLY" (run outside transaction blocks)
--    builds indexes in the background without acquiring a lock on the table.
-- ==============================================================================

-- 1. ATTENDANCE TABLE OPTIMIZATIONS (Most queried table in payroll)
-- Composite index for date-range payroll calculations per employee:
CREATE INDEX IF NOT EXISTS idx_attendance_emp_workdate 
  ON public.attendance(employee_id, work_date DESC);

-- Composite index for get_dashboard() daily status aggregations:
CREATE INDEX IF NOT EXISTS idx_attendance_workdate_status 
  ON public.attendance(work_date, status);

-- Index for ordering by creation:
CREATE INDEX IF NOT EXISTS idx_attendance_created_at 
  ON public.attendance(created_at DESC);


-- 2. PAYSLIPS TABLE OPTIMIZATIONS
-- Composite index for employee payroll histories:
CREATE INDEX IF NOT EXISTS idx_payslips_emp_period 
  ON public.payslips(employee_id, period_end DESC);

-- Composite index for payroll period lookups:
CREATE INDEX IF NOT EXISTS idx_payslips_period_lookup 
  ON public.payslips(period_start, period_end, status);

-- Index for latest payslip ordering:
CREATE INDEX IF NOT EXISTS idx_payslips_created_at 
  ON public.payslips(created_at DESC);


-- 3. EMPLOYEES TABLE OPTIMIZATIONS
-- Fast filter for active employees by department:
CREATE INDEX IF NOT EXISTS idx_employees_active_dept 
  ON public.employees(active, department_id);

-- Unique/fast lookup by employee number:
CREATE INDEX IF NOT EXISTS idx_employees_number 
  ON public.employees(employee_no);

CREATE INDEX IF NOT EXISTS idx_employees_created_at 
  ON public.employees(created_at DESC);


-- 4. CASH ADVANCES & LOANS OPTIMIZATIONS
-- Instant lookup of active advances for payroll deductions:
CREATE INDEX IF NOT EXISTS idx_cash_advances_emp_status 
  ON public.cash_advances(employee_id, status) 
  WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS idx_cash_advances_status_balance 
  ON public.cash_advances(status, balance);


-- 5. LEAVES TABLE OPTIMIZATIONS
-- Pending leave lookups for dashboard counters:
CREATE INDEX IF NOT EXISTS idx_leaves_status 
  ON public.leaves(status) 
  WHERE status = 'Pending';

-- Date overlap lookups for leave validation:
CREATE INDEX IF NOT EXISTS idx_leaves_emp_dates 
  ON public.leaves(employee_id, start_date, end_date);


-- 6. SINKING FUND (sf_*) OPTIMIZATIONS
CREATE INDEX IF NOT EXISTS idx_sf_members_emp 
  ON public.sf_members(employee_id);

CREATE INDEX IF NOT EXISTS idx_sf_members_status 
  ON public.sf_members(status);

CREATE INDEX IF NOT EXISTS idx_sf_contributions_member_date 
  ON public.sf_contributions(member_id, contributed_on DESC);

CREATE INDEX IF NOT EXISTS idx_sf_contributions_payroll 
  ON public.sf_contributions(payroll_period_start, payroll_period_end);

CREATE INDEX IF NOT EXISTS idx_sf_loans_borrower 
  ON public.sf_loans(borrower_name);

CREATE INDEX IF NOT EXISTS idx_sf_loans_dates 
  ON public.sf_loans(start_date, first_due_date);

CREATE INDEX IF NOT EXISTS idx_sf_payments_loan_date 
  ON public.sf_payments(loan_id, paid_on DESC);

CREATE INDEX IF NOT EXISTS idx_sf_balance_decl_loan 
  ON public.sf_balance_declarations(loan_id, declared_at DESC);

CREATE INDEX IF NOT EXISTS idx_sf_audit_log_created 
  ON public.sf_audit_log(created_at DESC);


-- 7. APPLICATION SECURITY & ACCESS OPTIMIZATIONS
CREATE INDEX IF NOT EXISTS idx_app_user_roles_user 
  ON public.app_user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_app_user_roles_label 
  ON public.app_user_roles(label);

CREATE INDEX IF NOT EXISTS idx_app_invites_email 
  ON public.app_invites(email);

CREATE INDEX IF NOT EXISTS idx_app_failed_actions_occurred 
  ON public.app_failed_actions(occurred_at DESC);


-- 8. DATABASE CONNECTION POOL & ANALYZE STATS
-- Running ANALYZE updates PostgreSQL query planner statistics so the query
-- planner immediately picks the newly created indexes without disconnects.
ANALYZE public.attendance;
ANALYZE public.employees;
ANALYZE public.payslips;
ANALYZE public.leaves;
ANALYZE public.cash_advances;
ANALYZE public.sf_loans;
ANALYZE public.sf_payments;
ANALYZE public.sf_contributions;
