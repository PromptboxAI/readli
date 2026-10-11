-- Payments foundation (parents backend, item 5). Nothing here takes money.
--
-- Payments stay off until Kevin switches them on: this flag is false, and the app also needs
-- PAYMENTS_ENABLED=true plus provider keys. Only test-mode keys are accepted unless PAYMENTS_LIVE=true
-- (src/lib/billing/config.ts). Webhook events are stored once per provider event id, so a retried
-- delivery never grants a plan or credits twice. Both tables are server-only (service role).

insert into public.feature_flags (key, enabled, description) values
  ('payments', false, 'Real checkout for Readli Family, narrator slots, credit packs and gifts. Off until Kevin switches it on')
on conflict (key) do nothing;

-- One payment-provider customer per household.
create table public.billing_customers (
  household_id uuid primary key references public.households (id) on delete cascade,
  provider text not null check (provider in ('stripe')),
  customer_ref text not null,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, customer_ref)
);

-- Every verified webhook delivery, processed at most once.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  event_ref text not null,
  type text not null,
  livemode boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_ref)
);
create index payment_events_unprocessed on public.payment_events (received_at) where processed_at is null;

alter table public.billing_customers enable row level security;
alter table public.payment_events enable row level security;
-- No policies: only server route handlers (service role) read or write these.
