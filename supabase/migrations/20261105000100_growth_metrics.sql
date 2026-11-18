create table if not exists public.household_acquisition (
  household_id uuid primary key references public.households (id) on delete cascade,
  source text check (source is null or char_length(source) <= 80),
  medium text check (medium is null or char_length(medium) <= 80),
  campaign text check (campaign is null or char_length(campaign) <= 120),
  click_id text check (click_id is null or click_id in ('gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id')),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  landing_path text check (landing_path is null or char_length(landing_path) <= 200),
  first_seen_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.household_acquisition is 'How a family first found Readli (campaign tags, which kind of ad click ID, the referring site host), saved once when the family is created. All nulls means a direct visit. Never a click ID value, a full URL, or anything about a child.';

alter table public.household_acquisition enable row level security;
revoke all on public.household_acquisition from anon, authenticated;

create table if not exists public.subscription_cancellations (
  subscription_ref text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  reason text check (reason is null or reason in ('cancellation_requested', 'payment_failed', 'payment_disputed')),
  feedback text check (feedback is null or feedback in ('customer_service', 'low_quality', 'missing_features', 'other', 'switched_service', 'too_complex', 'too_expensive', 'unused')),
  comment text check (comment is null or char_length(comment) <= 1000),
  requested_at timestamptz not null,
  ends_at timestamptz,
  withdrawn_at timestamptz,
  livemode boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists subscription_cancellations_requested on public.subscription_cancellations (requested_at);
comment on table public.subscription_cancellations is 'Why a family plan was canceled, from Stripe cancellation_details: the reason (asked, failed payment, dispute) and the answer to Stripe''s customer portal cancel survey. withdrawn_at is set when the family turns the plan back on before it ends.';

alter table public.subscription_cancellations enable row level security;
revoke all on public.subscription_cancellations from anon, authenticated;
