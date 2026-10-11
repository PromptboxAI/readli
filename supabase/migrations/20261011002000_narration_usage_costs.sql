alter table public.narration_provider_usage
  add column household_id uuid references public.households (id) on delete set null,
  add column job_id uuid references public.narration_jobs (id) on delete set null,
  add column usd numeric(12, 6) not null default 0,
  add column attempts integer not null default 1;

create index narration_provider_usage_household on public.narration_provider_usage (household_id, at);

comment on column public.narration_credit_ledger.credits is 'Characters (1 Readli credit = plan characters_per_credit, 1000 by default).';
comment on column public.narration_credit_lots.credits is 'Characters (1 Readli credit = plan characters_per_credit, 1000 by default).';

alter table public.narration_jobs add column lease_until timestamptz;

alter table public.plan_settings
  alter column credit_packs set default '[{"id":"pack-small","credits":20,"priceCents":699},{"id":"pack-medium","credits":50,"priceCents":1499},{"id":"pack-large","credits":100,"priceCents":2499}]';

update public.plan_settings
  set credit_packs = '[{"id":"pack-small","credits":20,"priceCents":699},{"id":"pack-medium","credits":50,"priceCents":1499},{"id":"pack-large","credits":100,"priceCents":2499}]'
  where credit_packs = '[{"id":"pack-small","credits":600,"priceCents":299},{"id":"pack-medium","credits":1800,"priceCents":799},{"id":"pack-large","credits":3600,"priceCents":1499}]'::jsonb;
