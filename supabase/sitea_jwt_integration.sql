begin;

create table if not exists public.sitea_integration_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  transaction_id uuid null references public.transactions(id) on delete set null,
  shop_id uuid null references public.shops(id) on delete set null,
  customer_code text null,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  status text not null default 'processing' check (status in ('processing', 'success', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  response_status integer null,
  response_payload jsonb null,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sitea_integration_events_event_created
  on public.sitea_integration_events(event_type, created_at desc);

create index if not exists idx_sitea_integration_events_transaction_created
  on public.sitea_integration_events(transaction_id, created_at desc);

create index if not exists idx_sitea_integration_events_shop_created
  on public.sitea_integration_events(shop_id, created_at desc);

create index if not exists idx_sitea_integration_events_status_created
  on public.sitea_integration_events(status, created_at desc);

comment on table public.sitea_integration_events is 'Logs Site B <-> Site A integration events such as approved, rejected, and pending-count updates.';
comment on column public.sitea_integration_events.event_type is 'Integration event name, for example topup.approved or shop.pending_changed.';
comment on column public.sitea_integration_events.transaction_id is 'Related Site B transaction id when the event is tied to a specific transaction.';
comment on column public.sitea_integration_events.shop_id is 'Related internal shop id in Site B.';
comment on column public.sitea_integration_events.customer_code is 'Customer/member code related to the event.';
comment on column public.sitea_integration_events.direction is 'outbound = Site B calling Site A, inbound = Site A calling Site B.';
comment on column public.sitea_integration_events.status is 'Delivery result state.';
comment on column public.sitea_integration_events.request_payload is 'JSON body sent or received for the event.';
comment on column public.sitea_integration_events.response_status is 'HTTP status code returned by the remote side, if any.';
comment on column public.sitea_integration_events.response_payload is 'Response body returned by the remote side, if any.';
comment on column public.sitea_integration_events.error_message is 'Last delivery error message when the event failed.';

commit;
