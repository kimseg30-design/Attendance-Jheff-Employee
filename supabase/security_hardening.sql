-- SECURITY HARDENING MIGRATION — PH Attendance & Payroll
-- Run manually in Supabase SQL Editor as a database owner AFTER confirming
-- apps/ph-attendance-payroll Secrets > ZITE_API_KEY is the Supabase service_role
-- (legacy) or secret key. It must stay server-side and must never use a VITE_ prefix.
-- This intentionally blocks direct anon/authenticated PostgREST access.
-- If ZITE_API_KEY is only an anon/publishable key, DO NOT RUN until you replace it.

do $$
declare
  t text;
  p record;
  tables text[] := array[
    'departments','employees','attendance','leaves','cash_advances','payslips',
    'sf_members','sf_contributions','sf_loans','sf_payments',
    'sf_balance_declarations','sf_audit_log','sf_settings','sf_interest_accruals'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      for p in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = t
      loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
      execute format('revoke all privileges on table public.%I from anon, authenticated', t);
      execute format('grant all privileges on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

revoke all on function public.get_dashboard() from public, anon, authenticated;
grant execute on function public.get_dashboard() to service_role;

do $$
begin
  if to_regprocedure('public.sf_accrue_interest_cycles()') is not null then
    revoke all on function public.sf_accrue_interest_cycles() from public, anon, authenticated;
    grant execute on function public.sf_accrue_interest_cycles() to service_role;
  end if;
end $$;

-- Verify after running:
-- 1. Tables above have RLS enabled and no anon/authenticated write policies.
-- 2. App endpoints still read/write successfully with the server-side service_role key.
-- 3. Unauthenticated requests to app endpoints fail.
