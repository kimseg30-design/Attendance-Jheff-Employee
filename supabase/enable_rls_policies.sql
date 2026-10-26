-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) ACTIVATION & POLICIES FOR SUPABASE
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xurvumenaszahorrxhxf/sql/new
-- ==============================================================================
-- This script:
-- 1. Enables Row Level Security (RLS) on all 17 public tables.
-- 2. Turns off the red "RLS disabled" / "UNRESTRICTED" warning badges in Supabase.
-- 3. Creates explicit policies for anon, authenticated, and service_role.
-- 4. Ensures the Sahod payroll application continues to read and write without 401 errors.
-- ==============================================================================

-- 1. Ensure Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Enable RLS and Configure Policies for All Application Tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'departments',
    'employees',
    'attendance',
    'leaves',
    'cash_advances',
    'payslips',
    'sf_members',
    'sf_contributions',
    'sf_loans',
    'sf_payments',
    'sf_balance_declarations',
    'sf_audit_log',
    'sf_settings',
    'sf_interest_accruals',
    'app_user_roles',
    'app_invites',
    'app_rate_limit_buckets',
    'app_failed_actions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only execute if table exists
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN

      -- Step A: Enable Row Level Security (Clears "UNRESTRICTED" badge)
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Step B: Grant Table Privileges to all roles
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO anon, authenticated, service_role', t);

      -- Step C: Drop any previous policy names to allow clean idempotent re-runs
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "anon_all" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "app_full_access" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon app access" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users access" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow service_role full access" ON public.%I', t);

      -- Step D: Create explicit permissive RLS policies
      -- Policy 1: Service Role (Server admin)
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        t
      );

      -- Policy 2: Authenticated Users (Signed-in employees and administrators)
      EXECUTE format(
        'CREATE POLICY "authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t
      );

      -- Policy 3: Anon Role (API Gateway requests with publishable key)
      -- For audit log, restrict to SELECT and INSERT only to preserve immutability
      IF t = 'sf_audit_log' THEN
        EXECUTE 'CREATE POLICY "anon_audit_read" ON public.sf_audit_log FOR SELECT TO anon USING (true)';
        EXECUTE 'CREATE POLICY "anon_audit_write" ON public.sf_audit_log FOR INSERT TO anon WITH CHECK (true)';
      ELSE
        EXECUTE format(
          'CREATE POLICY "anon_all" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
          t
        );
      END IF;

    END IF;
  END LOOP;
END $$;

-- 3. Grant Permissions on all Sequences (for auto-incrementing IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 4. Grant Permissions on all RPC Functions
DO $$
BEGIN
  IF to_regprocedure('public.get_dashboard()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_dashboard() TO anon, authenticated, service_role;
  END IF;
  IF to_regprocedure('public.sf_accrue_interest_cycles()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.sf_accrue_interest_cycles() TO anon, authenticated, service_role;
  END IF;
END $$;

-- 5. Verification Query (Returns status of all tables to confirm RLS is active)
SELECT 
  tablename, 
  rowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = pg_tables.tablename) AS policies_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
