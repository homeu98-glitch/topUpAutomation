create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_login text not null unique,
  owner_password text not null,
  external_shop_id text unique,
  owner_external_id text,
  auth_source text not null default 'local',
  auto_approve_enabled boolean not null default false,
  auto_approve_interval_minutes integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_code text not null,
  total_amount numeric(12,2) not null default 0,
  item_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  items jsonb not null default '[]'::jsonb,
  approved_by text,
  approved_at timestamptz,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_transactions_shop_status_time
  on public.transactions(shop_id, status, submitted_at desc);

create index if not exists idx_transactions_shop_time
  on public.transactions(shop_id, submitted_at desc);

insert into public.shops (code, name, owner_login, owner_password)
values
  ('POC001', '表嫂美食', '60000000', '0000'),
  ('POC002', '示範茶餐廳', 'owner-demo', '123456')
on conflict (code) do nothing;

alter table public.shops add column if not exists auto_approve_enabled boolean not null default false;
alter table public.shops add column if not exists auto_approve_interval_minutes integer not null default 5;
alter table public.shops add column if not exists external_shop_id text unique;
alter table public.shops add column if not exists owner_external_id text;
alter table public.shops add column if not exists auth_source text not null default 'local';
alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('pending', 'approved', 'rejected'));

create table if not exists public.customer_accounts (
  code text primary key,
  password text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.customer_accounts alter column password drop not null;
alter table public.customer_accounts add column if not exists auth_source text not null default 'local';
alter table public.customer_accounts add column if not exists external_member_id text unique;
alter table public.customer_accounts add column if not exists full_name text;
alter table public.customer_accounts add column if not exists phone text;
alter table public.customer_accounts add column if not exists membership_status text;
alter table public.customer_accounts add column if not exists profile_json jsonb not null default '{}'::jsonb;
alter table public.customer_accounts add column if not exists provisioned_at timestamptz;
alter table public.customer_accounts add column if not exists last_login_at timestamptz;
alter table public.customer_accounts add column if not exists last_synced_at timestamptz;

create table if not exists public.membership_token_logins (
  id uuid primary key default gen_random_uuid(),
  jti text not null unique,
  token_hash text not null,
  issuer text not null,
  audience text not null,
  subject text not null,
  member_code text not null,
  portal_role text not null,
  status text not null,
  reject_reason text,
  expires_at timestamptz not null,
  used_at timestamptz,
  request_ip text,
  user_agent text,
  claims_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_membership_token_logins_member_code_created
  on public.membership_token_logins(member_code, created_at desc);

create index if not exists idx_membership_token_logins_status_created
  on public.membership_token_logins(status, created_at desc);

insert into public.customer_accounts (code, password)
values ('63936541', '1234')
on conflict (code) do update set password = excluded.password;
