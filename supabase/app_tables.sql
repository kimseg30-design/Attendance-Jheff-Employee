-- Tables that replace the Zite-hosted app tables in the standalone version.
-- Run once in the Supabase SQL editor after schema.sql / sinking_fund.sql.
create table if not exists app_user_roles (
  id uuid primary key default gen_random_uuid(),
  label text,
  user_id text unique not null,
  role text not null
);
create table if not exists app_invites (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null,
  invited_by text,
  created_at timestamptz default now()
);
create table if not exists app_rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  bucket_key text unique not null,
  request_count int not null default 0,
  window_start timestamptz
);
create table if not exists app_failed_actions (
  id uuid primary key default gen_random_uuid(),
  summary text,
  error_code text,
  user_email text,
  details text,
  endpoint text,
  occurred_at timestamptz not null default now()
);
-- Server-only: block the public anon key entirely.
alter table app_user_roles enable row level security;
alter table app_invites enable row level security;
alter table app_rate_limit_buckets enable row level security;
alter table app_failed_actions enable row level security;

-- Public bucket for payment proof uploads.
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true) on conflict (id) do nothing;
create policy "Signed-in users can upload" on storage.objects for insert to authenticated with check (bucket_id = 'uploads');
