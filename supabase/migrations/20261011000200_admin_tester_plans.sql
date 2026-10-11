alter table public.household_entitlements drop constraint if exists household_entitlements_source_check;
alter table public.household_entitlements add constraint household_entitlements_source_check
  check (source in ('subscription', 'gift', 'donated', 'trial', 'tester'));
alter table public.household_entitlements add column if not exists granted_by uuid references auth.users (id);
alter table public.household_entitlements add column if not exists note text;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id),
  admin_email text not null,
  action text not null check (action in ('tester_plan_granted', 'tester_plan_ended')),
  household_id uuid references public.households (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_recent on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
