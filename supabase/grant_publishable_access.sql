-- GRANT PUBLISHABLE / ANON ACCESS MIGRATION
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/xurvumenaszahorrxhxf/sql/new)
-- This allows the publishable/anon API key to read and write to the application tables.

-- 1. Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant privileges on all existing tables and sequences
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- 3. Set default privileges for any future tables created
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- 4. Disable RLS or create open access policies for app tables
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
      EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 5. Grant RPC functions
DO $$
BEGIN
  IF to_regprocedure('public.get_dashboard()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_dashboard() TO anon, authenticated;
  END IF;
  IF to_regprocedure('public.sf_accrue_interest_cycles()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.sf_accrue_interest_cycles() TO anon, authenticated;
  END IF;
END $$;
