-- Readli Rewards revision and the annual gift price (Kevin, 2026-10-10).
--
-- * The 12-month gift is $149.99. Gift payments stay off (gift_plans.active = false).
-- * The introductory free month is replaced by a 14-day free trial for eligible new
--   Readli Family households, with a small narration allowance.
-- * A referrer earns one free subscription month once the referred household has
--   completed its second successful paid monthly cycle, at most three months in any
--   rolling 12 months. One referrer per household, one month per referred household.
-- * A free month waives a subscription charge; it never adds narration allowance.
-- * Every limit lives in reward_settings, and the program stays off until switched on.
-- Rules mirror src/lib/rewards/rewards.ts. Nothing here is ever about a child.

update public.gift_plans set price_cents = 14999 where id = 'prepaid_12m';

-- ---------------------------------------------------------------------------
-- Settings (one row, admin-editable)
-- ---------------------------------------------------------------------------
create table public.reward_settings (
  id boolean primary key default true check (id),
  program_public boolean not null default false,
  trial_days smallint not null default 14 check (trial_days between 0 and 90),
  trial_narration_minutes smallint not null default 10 check (trial_narration_minutes between 0 and 600),
  referral_paid_cycles smallint not null default 2 check (referral_paid_cycles between 1 and 12),
  referral_months_per_12 smallint not null default 3 check (referral_months_per_12 between 0 and 12),
  updated_at timestamptz not null default now()
);
insert into public.reward_settings default values;

-- ---------------------------------------------------------------------------
-- Free trial: once per household, and once per verified email, phone or card
-- ---------------------------------------------------------------------------
create table public.household_trials (
  household_id uuid primary key references public.households (id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  narration_seconds integer not null check (narration_seconds >= 0),
  check (ends_at > started_at)
);

-- Hashed signals (verified email, phone, payment fingerprint) already used for a
-- trial. A second account with the same signal can't start another trial.
create table public.trial_signals (
  signal_hash text primary key check (char_length(signal_hash) = 64),
  kind text not null check (kind in ('email', 'phone', 'payment_method')),
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.guard_trial_start() returns trigger
language plpgsql as $$
begin
  if not (select program_public from public.reward_settings) then
    raise exception 'Readli Rewards is not switched on' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.household_entitlements e where e.household_id = new.household_id) then
    raise exception 'household already had Readli Family' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger household_trials_guard before insert on public.household_trials
  for each row execute function public.guard_trial_start();

-- ---------------------------------------------------------------------------
-- Referrals, by household (replaces the per-user tables from 000500, unused so far)
-- ---------------------------------------------------------------------------
drop table public.reward_grants;
drop table public.referrals;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_household_id uuid not null references public.households (id) on delete cascade,
  -- First link wins: a household can be referred once.
  referred_household_id uuid not null unique references public.households (id) on delete cascade,
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  attributed_at timestamptz not null default now(),
  -- Monthly charges the referred household paid itself. Trial, gift, donated and
  -- reward months never count.
  paid_cycles smallint not null default 0 check (paid_cycles >= 0),
  qualified_at timestamptz,
  rejected_reason text check (rejected_reason in ('self_referral', 'existing_customer', 'circular')),
  check (referrer_household_id <> referred_household_id),
  check (qualified_at is null or rejected_reason is null)
);
create index referrals_referrer on public.referrals (referrer_household_id);

create table public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  reward text not null default 'referral_free_month' check (reward = 'referral_free_month'),
  -- One month per referred household, ever.
  referral_id uuid not null unique references public.referrals (id) on delete restrict,
  granted_at timestamptz not null default now(),
  -- Set when the month waives a subscription charge. Never adds narration allowance.
  applied_at timestamptz
);
create index reward_grants_household on public.reward_grants (household_id, granted_at);

create function public.guard_reward_grant() returns trigger
language plpgsql as $$
declare
  s public.reward_settings;
  r public.referrals;
  recent integer;
begin
  select * into s from public.reward_settings;
  if not s.program_public then
    raise exception 'Readli Rewards is not switched on' using errcode = 'check_violation';
  end if;
  select * into r from public.referrals where id = new.referral_id;
  if r.referrer_household_id <> new.household_id then
    raise exception 'reward must go to the referring household' using errcode = 'check_violation';
  end if;
  if r.rejected_reason is not null or r.paid_cycles < s.referral_paid_cycles then
    raise exception 'referral has not qualified' using errcode = 'check_violation';
  end if;
  -- Serialize grants per household so two at once can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtext('reward_grants:' || new.household_id::text));
  select count(*) into recent from public.reward_grants g
    where g.household_id = new.household_id and g.granted_at > new.granted_at - interval '365 days';
  if recent >= s.referral_months_per_12 then
    raise exception 'referral reward cap reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger reward_grants_guard before insert on public.reward_grants
  for each row execute function public.guard_reward_grant();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.reward_settings enable row level security;
alter table public.household_trials enable row level security;
alter table public.trial_signals enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_grants enable row level security;

-- Guardians see their household's trial and earned months; nothing else is readable.
create policy "members read household trial" on public.household_trials
  for select using (public.is_active_member(auth.uid(), household_id));
create policy "members read household reward months" on public.reward_grants
  for select using (public.is_active_member(auth.uid(), household_id));

-- reward_settings, trial_signals, referrals: service role only.
