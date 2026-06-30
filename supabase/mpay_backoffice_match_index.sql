-- Flatten trade_no / order_no / pay_order_no into an indexed lookup table
-- so application code can match many candidate numbers efficiently.

begin;

create table if not exists public.transactions_from_mpaybackoffice_match_index (
  source_row_id text not null,
  match_source text not null check (match_source in ('trade_no', 'order_no', 'pay_order_no')),
  match_value text not null,
  transaction_status text null,
  updated_at timestamptz not null default now(),
  primary key (source_row_id, match_source, match_value)
);

create index if not exists idx_mpaybackoffice_match_value
  on public.transactions_from_mpaybackoffice_match_index (match_value);

create index if not exists idx_mpaybackoffice_match_status
  on public.transactions_from_mpaybackoffice_match_index (transaction_status);

create or replace function public.refresh_mpaybackoffice_match_index_row()
returns trigger
language plpgsql
as $$
declare
  v_source_row_id text;
begin
  v_source_row_id := coalesce(to_jsonb(new)->>'id', md5(row_to_json(new)::text));

  delete from public.transactions_from_mpaybackoffice_match_index
  where source_row_id = v_source_row_id;

  insert into public.transactions_from_mpaybackoffice_match_index (source_row_id, match_source, match_value, transaction_status)
  select v_source_row_id, src.match_source, src.match_value, new.transaction_status
  from (
    values
      ('trade_no', nullif(trim(coalesce(new.trade_no::text, '')), '')),
      ('order_no', nullif(trim(coalesce(new.order_no::text, '')), '')),
      ('pay_order_no', nullif(trim(coalesce(new.pay_order_no::text, '')), ''))
  ) as src(match_source, match_value)
  where src.match_value is not null;

  return new;
end;
$$;

create or replace function public.delete_mpaybackoffice_match_index_row()
returns trigger
language plpgsql
as $$
declare
  v_source_row_id text;
begin
  v_source_row_id := coalesce(to_jsonb(old)->>'id', md5(row_to_json(old)::text));

  delete from public.transactions_from_mpaybackoffice_match_index
  where source_row_id = v_source_row_id;

  return old;
end;
$$;

drop trigger if exists trg_refresh_mpaybackoffice_match_index_ins_upd on public.transactions_from_mpaybackoffice;
create trigger trg_refresh_mpaybackoffice_match_index_ins_upd
after insert or update of trade_no, order_no, pay_order_no, transaction_status
on public.transactions_from_mpaybackoffice
for each row
execute function public.refresh_mpaybackoffice_match_index_row();

drop trigger if exists trg_delete_mpaybackoffice_match_index on public.transactions_from_mpaybackoffice;
create trigger trg_delete_mpaybackoffice_match_index
after delete
on public.transactions_from_mpaybackoffice
for each row
execute function public.delete_mpaybackoffice_match_index_row();

insert into public.transactions_from_mpaybackoffice_match_index (source_row_id, match_source, match_value, transaction_status)
select
  coalesce(to_jsonb(t)->>'id', md5(row_to_json(t)::text)) as source_row_id,
  src.match_source,
  src.match_value,
  t.transaction_status
from public.transactions_from_mpaybackoffice t
cross join lateral (
  values
    ('trade_no', nullif(trim(coalesce(t.trade_no::text, '')), '')),
    ('order_no', nullif(trim(coalesce(t.order_no::text, '')), '')),
    ('pay_order_no', nullif(trim(coalesce(t.pay_order_no::text, '')), ''))
) as src(match_source, match_value)
where src.match_value is not null
on conflict (source_row_id, match_source, match_value)
do update set
  transaction_status = excluded.transaction_status,
  updated_at = now();

commit;
