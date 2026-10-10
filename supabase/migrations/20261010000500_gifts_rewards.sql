-- Invite Family, Invite & Gift and Readli Rewards (Kevin, 2026-10-10).
-- Payments stay off: no gift plan can be activated without a final price, and
-- no gift can be created against an inactive plan. Accepting a family
-- invitation adds a household_members row with role 'member' and nothing
-- else: no voice share, no child approval, no subscription.
-- Givers never read gifts directly: server routes return only the giver-visible
-- fields (src/lib/gifting/lifecycle.ts GIVER_VISIBLE_FIELDS), so a giver can't
-- see the recipient's household, children or voices.
--
-- Readli Rewards (revised by Kevin the same day): eligible new Readli Family
-- households get a 14-day trial with a small narration allowance. A referrer
-- earns one free subscription month once the referred household has completed
-- its second successful paid monthly cycle, at most three months in any rolling
-- 12 months; one referrer per household, one month per referred household. A
-- free month waives a subscription charge and never adds narration allowance.
-- Limits live in reward_settings and the program stays off until switched on.
-- The 12-month gift is $149.99. Rules mirror src/lib/rewards/rewards.ts.

insert into public.feature_flags (key, enabled, description) values
  ('gift_payments', false, 'Invite & Gift checkout. Stays off until subscription prices are final'),
  ('readli_rewards', false, 'Readli Rewards tracker and referral rewards (adults only)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Family invitations (PRD F-04)
-- ---------------------------------------------------------------------------
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique, -- sha256 of the single-use link token
  invitee_name text not null check (char_length(invitee_name) <= 120),
  relationship_label text, -- display only (Amendment 001 F-8)
  recipient_email_hash text, -- null when sent as a shared link
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);

create index household_invitations_household on public.household_invitations (household_id);

-- Accept an invitation: one membership row, nothing more. Returns the household id.
create or replace function public.accept_household_invitation(p_token_hash text, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.household_invitations;
begin
  select * into v_inv from public.household_invitations
  where token_hash = p_token_hash
  for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation is not valid' using errcode = 'check_violation';
  end if;
  insert into public.household_members (household_id, user_id, role, relationship_label)
  values (v_inv.household_id, p_user, 'member', v_inv.relationship_label)
  on conflict (household_id, user_id) do update set removed_at = null, joined_at = now();
  update public.household_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
  return v_inv.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gifts
-- ---------------------------------------------------------------------------
create table public.gift_plans (
  id text primary key check (id in ('prepaid_1m', 'prepaid_3m', 'prepaid_12m', 'sponsored_monthly')),
  kind text not null check (kind in ('prepaid', 'recurring')),
  months smallint check (months in (1, 3, 12)),
  price_cents integer check (price_cents > 0),
  currency text not null default 'usd',
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  check ((kind = 'prepaid') = (months is not null)),
  -- A plan can't be sold until it has a final price.
  check (not active or price_cents is not null)
);

-- Priced at the Readli Family monthly price ($14.99), one month per month gifted. Not on sale
-- (active = false) until checkout is switched on. A redeemed gift becomes a
-- household_entitlements row with source 'gift' (family migration 000600).
insert into public.gift_plans (id, kind, months, price_cents) values
  ('prepaid_1m', 'prepaid', 1, 1499),
  ('prepaid_3m', 'prepaid', 3, 4497),
  ('prepaid_12m', 'prepaid', 12, 14999),
  ('sponsored_monthly', 'recurring', null, 1499)
on conflict (id) do nothing;

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  giver_id uuid not null references auth.users (id) on delete restrict,
  plan_id text not null references public.gift_plans (id),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'scheduled', 'sent', 'active', 'ended', 'cancelled', 'unclaimed')),
  code_hash text not null unique, -- sha256 of the gift code; the code itself is never stored
  recipient_name text not null check (char_length(recipient_name) <= 120),
  recipient_email text, -- needed to deliver; cleared once the gift is redeemed
  giver_display_name text not null check (char_length(giver_display_name) <= 120),
  message text check (char_length(message) <= 300),
  deliver_on date not null default current_date,
  sent_at timestamptz,
  redeemed_at timestamptz,
  recipient_user_id uuid references auth.users (id) on delete set null,
  paid_through timestamptz,
  renewals_stopped boolean not null default false,
  payment_ref text, -- payment provider id; server-only
  refund_state text not null default 'none' check (refund_state in ('none', 'pending', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (giver_id is distinct from recipient_user_id),
  check ((status in ('active', 'ended')) = (redeemed_at is not null) or status = 'cancelled')
);

-- Payments off means no gift rows at all: inserts need an active (priced) plan.
create or replace function public.gifts_require_active_plan() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.gift_plans where id = new.plan_id and active) then
    raise exception 'gift plan % is not on sale yet', new.plan_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger gifts_active_plan before insert on public.gifts
  for each row execute function public.gifts_require_active_plan();
create trigger gifts_updated before update on public.gifts
  for each row execute function public.set_updated_at();

create table public.gift_notices (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts (id) on delete cascade,
  audience text not null check (audience in ('giver', 'recipient')),
  kind text not null check (kind in ('renewal_upcoming', 'gift_ending', 'sponsorship_ending', 'gift_cancelled')),
  send_at timestamptz not null,
  sent_at timestamptz,
  unique (gift_id, audience, kind, send_at)
);

create index gifts_giver on public.gifts (giver_id);
create index gifts_recipient on public.gifts (recipient_user_id) where recipient_user_id is not null;
create index gift_notices_due on public.gift_notices (send_at) where sent_at is null;

-- ---------------------------------------------------------------------------
-- Readli Rewards (adults only; nothing here is ever about a child)
-- ---------------------------------------------------------------------------
create table public.reward_activities (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity text not null
    check (activity in ('family_account', 'family_library', 'invite_storyteller', 'first_voice_or_story', 'referral')),
  completed_at timestamptz not null default now(),
  primary key (user_id, activity)
);

create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  created_at timestamptz not null default now()
);

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
-- Referrals, by household
-- ---------------------------------------------------------------------------

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
alter table public.household_invitations enable row level security;
alter table public.gift_plans enable row level security;
alter table public.gifts enable row level security;
alter table public.gift_notices enable row level security;
alter table public.reward_activities enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_grants enable row level security;
alter table public.reward_settings enable row level security;
alter table public.household_trials enable row level security;
alter table public.trial_signals enable row level security;

-- Active members see their household's invitations (never the token).
create policy "members read household invitations" on public.household_invitations
  for select using (public.is_active_member(auth.uid(), household_id));

-- Plans (and whether they're on sale) are public.
create policy "public gift plans" on public.gift_plans for select using (true);

-- Adults read their own rewards progress and referral link.
create policy "read own reward activities" on public.reward_activities for select using (auth.uid() = user_id);
create policy "members read household reward months" on public.reward_grants
  for select using (public.is_active_member(auth.uid(), household_id));
create policy "members read household trial" on public.household_trials
  for select using (public.is_active_member(auth.uid(), household_id));
create policy "read own referral code" on public.referral_codes for select using (auth.uid() = user_id);

-- gifts, gift_notices, referrals, reward_settings, trial_signals: service role only
-- (server returns giver-safe fields).
