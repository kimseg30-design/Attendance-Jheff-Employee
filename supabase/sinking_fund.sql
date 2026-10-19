-- Sinking Fund module — run once in Supabase → SQL Editor (after schema.sql).

create table if not exists sf_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  contact_no text,
  email text,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  employee_id uuid references employees(id) on delete set null,
  base_contribution numeric(12,2) not null default 0 check (base_contribution >= 0),
  joined_on date default (now() at time zone 'Asia/Manila')::date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sf_contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references sf_members(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  contributed_on date not null default (now() at time zone 'Asia/Manila')::date,
  reference_no text,
  payroll_period_start date,
  payroll_period_end date,
  notes text,
  created_at timestamptz not null default now(),
  constraint sf_contributions_payroll_period_valid check (payroll_period_start is null or payroll_period_end is null or payroll_period_end >= payroll_period_start)
);

create table if not exists sf_loans (
  id uuid primary key default gen_random_uuid(),
  borrower_name text not null,
  contact_no text,
  address text,
  loan_group text default '1st Group' check (loan_group in ('1st Group','2nd Group')),
  loan_type text default 'New Loan' check (loan_type in ('New Loan','Reloan')),
  principal numeric(14,2) not null,
  monthly_rate numeric(6,3) not null default 5,
  term_months int not null default 1,
  frequency text not null default 'Monthly' check (frequency in ('Weekly','Biweekly','Monthly')),
  penalty_rate numeric(6,3) not null default 2,
  grace_days int not null default 3,
  start_date date not null,
  first_due_date date not null,
  early_settlement boolean not null default false,
  declared_principal numeric(14,2),
  declared_at date,
  purpose text,
  created_at timestamptz not null default now()
);

create table if not exists sf_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references sf_loans(id) on delete cascade,
  paid_on date not null,
  amount numeric(14,2) not null default 0,
  late_fee numeric(14,2) not null default 0,
  prepay_interest boolean not null default false,
  reference_no text,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists sf_payments_loan_idx on sf_payments(loan_id);

create table if not exists sf_balance_declarations (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references sf_loans(id) on delete cascade,
  previous_principal numeric(14,2),
  declared_principal numeric(14,2) not null,
  declared_at date not null,
  reason text,
  declared_by text,
  created_at timestamptz not null default now()
);

create table if not exists sf_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity text,
  entity_id text,
  details text,
  actor text,
  created_at timestamptz not null default now()
);

create table if not exists sf_settings (
  id int primary key default 1 check (id = 1),
  creditor_name text default 'Sinking Fund',
  creditor_address text,
  default_monthly_rate numeric(6,3) default 5,
  default_penalty_rate numeric(6,3) default 2,
  default_grace_days int default 3,
  created_at timestamptz not null default now()
);
insert into sf_settings (id) values (1) on conflict do nothing;

-- Audit log is append-only: block updates and deletes at the database level.
create or replace function sf_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'Audit log is immutable'; end $$;
drop trigger if exists sf_audit_no_change on sf_audit_log;
create trigger sf_audit_no_change before update or delete on sf_audit_log
  for each row execute function sf_audit_immutable();

-- Secure-by-default: access is through authenticated server endpoints only.
do $$
declare t text;
begin
  foreach t in array array['sf_members','sf_contributions','sf_loans','sf_payments','sf_balance_declarations','sf_audit_log','sf_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_full_access on public.%I', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;
