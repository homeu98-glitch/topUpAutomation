create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_login text not null unique,
  owner_password text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_code text not null,
  total_amount numeric(12,2) not null default 0,
  item_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved')),
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
  ('POC001', '表嫂美食', 'owner-biuso', '123456'),
  ('POC002', '示範茶餐廳', 'owner-demo', '123456')
on conflict (code) do nothing;
