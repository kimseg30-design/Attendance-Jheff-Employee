-- Automatic Sinking Fund loan interest accrual
-- Run this file in Supabase SQL Editor after sinking_fund.sql.
-- Daily job runs at 00:10 UTC (08:10 Philippine time).
-- This records each interest charge once, using the same rule as the app:
-- one month's interest at release, +1 each monthly anniversary during the term,
-- then a fixed charge (principal x rate) the day after maturity and monthly after,
-- until the loan is fully paid.

create table if not exists public.sf_interest_accruals (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.sf_loans(id) on delete cascade,
  base_date date not null,
  cycle_no integer not null check (cycle_no >= 1),
  principal_basis numeric(14,2) not null,
  monthly_rate numeric(6,3) not null,
  interest_amount numeric(14,2) not null,
  accrued_on date not null,
  created_at timestamptz not null default now(),
  constraint sf_interest_accruals_loan_basis_cycle_unique
    unique (loan_id, base_date, cycle_no)
);

create index if not exists sf_interest_accruals_loan_idx
  on public.sf_interest_accruals (loan_id, accrued_on);

alter table public.sf_interest_accruals enable row level security;
drop policy if exists app_full_access on public.sf_interest_accruals;
revoke all privileges on table public.sf_interest_accruals from anon, authenticated;
grant all privileges on table public.sf_interest_accruals to service_role;

create or replace function public.sf_accrue_interest_cycles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with loan_basis as (
    select
      l.id as loan_id,
      case when l.declared_at is not null and l.declared_principal is not null
        then l.declared_at else l.start_date end as base_date,
      case when l.declared_at is not null and l.declared_principal is not null
        then l.declared_principal else l.principal end as principal_basis,
      l.monthly_rate,
      l.frequency,
      case when l.declared_at is not null and l.declared_principal is not null
        then null else l.first_due_date end as orig_first_due,
      greatest(
        1,
        l.term_months - case
          when l.declared_at is not null and l.declared_principal is not null
          then greatest(0, (extract(year from l.declared_at)::int - extract(year from l.start_date)::int) * 12
                + extract(month from l.declared_at)::int - extract(month from l.start_date)::int)
          else 0
        end
      ) as remaining_term,
      l.early_settlement
    from public.sf_loans l
  ),
  with_maturity as (
    -- Maturity = last scheduled due date (same rule as the app).
    select b.*,
      (case b.frequency
        when 'Monthly' then coalesce(b.orig_first_due, (b.base_date + interval '1 month')::date) + make_interval(months => b.remaining_term - 1)
        when 'Biweekly' then coalesce(b.orig_first_due, b.base_date + 14) + (b.remaining_term * 2 - 1) * 14
        else coalesce(b.orig_first_due, b.base_date + 7) + (b.remaining_term * 4 - 1) * 7
      end)::date as maturity,
      coalesce((select sum(p.amount) from public.sf_payments p where p.loan_id = b.loan_id and p.paid_on > b.base_date - case when b.orig_first_due is null then 0 else 100000 end), 0) as paid_total
    from loan_basis b
  ),
  all_cycles as (
    -- In-term: cycle 1 at release, +1 on each monthly anniversary.
    select m.*, k + 1 as cycle_no,
      case when k = 0 then m.base_date else (m.base_date + make_interval(months => k) + interval '1 day')::date end as accrued_on
    from with_maturity m
    cross join lateral generate_series(0, case when m.early_settlement then 0 else m.remaining_term - 1 end) as k
    union all
    -- Post-maturity: fixed charge the day after maturity, then monthly.
    select m.*, m.remaining_term + n + 1 as cycle_no,
      (m.maturity + make_interval(months => n) + interval '1 day')::date as accrued_on
    from with_maturity m
    cross join lateral generate_series(0, 600) as n
    where not m.early_settlement
  ),
  due_cycles as (
    select
      c.loan_id, c.base_date, c.cycle_no, c.principal_basis, c.monthly_rate,
      round(c.principal_basis * c.monthly_rate / 100.0, 2) as interest_amount,
      c.accrued_on
    from all_cycles c
    where c.accrued_on <= (now() at time zone 'Asia/Manila')::date
      -- stop once the loan was fully paid before this charge
      and (c.cycle_no = 1 or c.paid_total < c.principal_basis + (c.cycle_no - 1) * round(c.principal_basis * c.monthly_rate / 100.0, 2) - 0.009)
  ),
  inserted as (
    insert into public.sf_interest_accruals
      (loan_id, base_date, cycle_no, principal_basis, monthly_rate, interest_amount, accrued_on)
    select
      loan_id, base_date, cycle_no, principal_basis, monthly_rate, interest_amount, accrued_on
    from due_cycles
    on conflict (loan_id, base_date, cycle_no) do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

-- Backfill all interest cycles already due as of today.
select public.sf_accrue_interest_cycles();

-- Enable the daily schedule. Re-running this script replaces the same named job.
create extension if not exists pg_cron;

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'sf-interest-accrual-daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

select cron.schedule(
  'sf-interest-accrual-daily',
  '10 0 * * *',
  $job$select public.sf_accrue_interest_cycles();$job$
);
