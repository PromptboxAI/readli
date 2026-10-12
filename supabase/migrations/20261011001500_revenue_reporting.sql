create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete set null,
  payer_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('subscription', 'narrator_slot', 'credit_pack', 'gift')),
  amount_cents integer not null,
  currency text not null default 'usd',
  billing_interval text check (billing_interval in ('month', 'year')),
  quantity integer not null default 1 check (quantity >= 0),
  period_start timestamptz,
  period_end timestamptz,
  provider text not null default 'stripe',
  provider_ref text not null,
  livemode boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_ref),
  check ((kind in ('subscription', 'narrator_slot')) = (billing_interval is not null)),
  check (period_end is null or period_start is null or period_end > period_start)
);
create index if not exists revenue_events_occurred on public.revenue_events (occurred_at desc);
create index if not exists revenue_events_household on public.revenue_events (household_id);
alter table public.revenue_events enable row level security;
