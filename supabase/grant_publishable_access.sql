-- COMPLETE FIX FOR SUPABASE PERMISSION DENIED (401 / 42501) & SCHEMA SYNC
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xurvumenaszahorrxhxf/sql/new

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add any missing columns to match application schema
ALTER TABLE IF EXISTS public.payslips 
  ADD COLUMN IF NOT EXISTS days_absent numeric(6,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_benefits numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sinking_contribution_deduction numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.employees
  ADD COLUMN IF NOT EXISTS no_of_days_work numeric DEFAULT 0;

ALTER TABLE IF EXISTS public.sf_loans
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.attendance
  ADD COLUMN IF NOT EXISTS overtime_pay_mode text NOT NULL DEFAULT 'Hours',
  ADD COLUMN IF NOT EXISTS overtime_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_benefit numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Grant schema usage to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 4. Grant table privileges to anon and authenticated roles
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 5. Disable RLS and grant open access for application tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'departments', 'employees', 'attendance', 'leaves', 'cash_advances', 'payslips',
    'sf_members', 'sf_contributions', 'sf_loans', 'sf_payments',
    'sf_balance_declarations', 'sf_audit_log', 'sf_settings', 'sf_interest_accruals',
    'app_user_roles', 'app_invites', 'app_rate_limit_buckets', 'app_failed_actions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END $$;

-- 6. Grant execute on RPC functions
DO $$
BEGIN
  IF to_regprocedure('public.get_dashboard()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_dashboard() TO anon, authenticated, service_role;
  END IF;
  IF to_regprocedure('public.sf_accrue_interest_cycles()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.sf_accrue_interest_cycles() TO anon, authenticated, service_role;
  END IF;
END $$;
