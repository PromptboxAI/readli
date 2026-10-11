
insert into public.feature_flags (key, enabled, description) values
  ('payments', false, 'Real checkout for Readli Family, narrator slots, credit packs and gifts. Off until Kevin switches it on')
on conflict (key) do nothing;

create table public.billing_customers (
  household_id uuid primary key references public.households (id) on delete cascade,
  provider text not null check (provider in ('stripe')),
  customer_ref text not null,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, customer_ref)
);

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

create unique index household_entitlements_subscription_ref
  on public.household_entitlements (provider_subscription_ref) where provider_subscription_ref is not null;

create unique index narration_credit_lots_payment_ref
  on public.narration_credit_lots (payment_ref) where payment_ref is not null;

alter table public.billing_customers enable row level security;
alter table public.payment_events enable row level security;
