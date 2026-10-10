-- Final Signup Architecture and Subscription Pricing (Kevin, 2026-10-10).
-- Readli Family (paid, gifted or donated) households hold entitlements: narrator
-- slots, child profiles and concurrent child streams. Readli Voice contributor
-- households hold none and pay nothing. One voice_profiles row per adult is shared
-- by reference with any number of households; nothing here copies a voice.
-- A child hears a voice only with all three, each kept separately:
--   voice_household_shares (owner consent), narrator_activations (household slot),
--   child_voice_approvals (parent, per child).

-- ---------------------------------------------------------------------------
-- Admin-configurable plan settings (single row)
-- ---------------------------------------------------------------------------
create table public.plan_settings (
  id boolean primary key default true check (id),
  family_monthly_price_cents integer not null default 1499 check (family_monthly_price_cents > 0),
  included_narrator_slots smallint not null default 2 check (included_narrator_slots >= 0),
  extra_narrator_slot_price_cents integer not null default 299 check (extra_narrator_slot_price_cents > 0),
  extra_narrator_slot_price_status text not null default 'proposed' check (extra_narrator_slot_price_status in ('proposed', 'approved')),
  free_contributor_voice_allowance smallint not null default 1 check (free_contributor_voice_allowance >= 1),
  contributor_household_max_adults smallint not null default 2 check (contributor_household_max_adults >= 1),
  max_child_profiles smallint not null default 6 check (max_child_profiles >= 1),
  included_concurrent_streams smallint not null default 3 check (included_concurrent_streams >= 1),
  extra_streams_for_sale boolean not null default false,
  gifted_membership_entitlements text not null default 'same_as_family' check (gifted_membership_entitlements = 'same_as_family'),
  narrator_swaps_per_30_days smallint not null default 2 check (narrator_swaps_per_30_days >= 0),
  voice_recording_attempts_per_day smallint not null default 5,
  voice_replacements_per_year smallint not null default 3,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
insert into public.plan_settings default values;

-- Gifts are priced at the family monthly price, one month per month gifted. Still not on sale.
update public.gift_plans set price_cents = case id
  when 'prepaid_1m' then 1499 when 'prepaid_3m' then 4497 when 'prepaid_12m' then 17988 when 'sponsored_monthly' then 1499 end;

-- ---------------------------------------------------------------------------
-- Households and subscriptions
-- ---------------------------------------------------------------------------
alter table public.households
  add column kind text not null default 'family' check (kind in ('family', 'contributor'));

create table public.household_subscriptions (
  household_id uuid primary key references public.households (id) on delete cascade,
  source text not null check (source in ('paid', 'gift', 'donated')),
  status text not null check (status in ('active', 'past_due', 'cancelled', 'expired')),
  paid_through timestamptz not null,
  extra_narrator_slots smallint not null default 0 check (extra_narrator_slots >= 0),
  gift_id uuid references public.gifts (id) on delete set null,
  payment_ref text, -- payment provider id; server-only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger household_subscriptions_updated before update on public.household_subscriptions
  for each row execute function public.set_updated_at();

create or replace function public.household_entitlements(p_household uuid)
returns table (family boolean, narrator_slots integer, max_child_profiles integer, concurrent_streams integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(live.ok, false),
    case when live.ok then ps.included_narrator_slots + live.extra else 0 end,
    case when live.ok then ps.max_child_profiles::integer else 0 end,
    case when live.ok then ps.included_concurrent_streams::integer else 0 end
  from public.plan_settings ps
  left join lateral (
    select true as ok, s.extra_narrator_slots::integer as extra
    from public.household_subscriptions s
    where s.household_id = p_household and s.status in ('active', 'past_due') and s.paid_through > now()
  ) live on true;
$$;

-- ---------------------------------------------------------------------------
-- Narrator slots
-- ---------------------------------------------------------------------------
create table public.narrator_activations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  activated_by uuid not null references auth.users (id),
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz
);
create unique index narrator_activations_one_live
  on public.narrator_activations (household_id, voice_id) where deactivated_at is null;
create index narrator_activations_recent on public.narrator_activations (household_id, activated_at);

-- Activating needs the owner's live share, a free slot and the monthly change limit.
create or replace function public.narrator_activation_guard() returns trigger
language plpgsql as $$
declare
  v_ent record;
  v_swaps integer;
begin
  select * into v_ent from public.household_entitlements(new.household_id);
  if not v_ent.family then
    raise exception 'narrator slots need Readli Family' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.voice_household_shares s
    where s.voice_id = new.voice_id and s.household_id = new.household_id and s.revoked_at is null
  ) then
    raise exception 'the voice owner has not shared this voice with the household' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.narrator_activations a
      where a.household_id = new.household_id and a.deactivated_at is null) >= v_ent.narrator_slots then
    raise exception 'no free narrator slot' using errcode = 'check_violation';
  end if;
  select narrator_swaps_per_30_days into v_swaps from public.plan_settings;
  if (select count(*) from public.narrator_activations a
      where a.household_id = new.household_id and a.activated_at > now() - interval '30 days') >= v_ent.narrator_slots + v_swaps then
    raise exception 'narrator change limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger narrator_activations_guard before insert on public.narrator_activations
  for each row execute function public.narrator_activation_guard();

-- Owner stops sharing: the household's slot frees up straight away.
create or replace function public.free_slot_on_unshare() returns trigger
language plpgsql as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update public.narrator_activations set deactivated_at = now()
    where voice_id = new.voice_id and household_id = new.household_id and deactivated_at is null;
  end if;
  return new;
end;
$$;
create trigger voice_household_shares_free_slot after update on public.voice_household_shares
  for each row execute function public.free_slot_on_unshare();

-- ---------------------------------------------------------------------------
-- Child profiles: capped, never billed per child
-- ---------------------------------------------------------------------------
create or replace function public.child_profile_limit_guard() returns trigger
language plpgsql as $$
declare
  v_ent record;
begin
  select * into v_ent from public.household_entitlements(new.household_id);
  if not v_ent.family then
    raise exception 'child profiles need Readli Family' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.child_profiles c
      where c.household_id = new.household_id and c.deleted_at is null) >= v_ent.max_child_profiles then
    raise exception 'child profile limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger child_profiles_limit before insert on public.child_profiles
  for each row execute function public.child_profile_limit_guard();

-- ---------------------------------------------------------------------------
-- Concurrent child listening sessions
-- ---------------------------------------------------------------------------
create table public.stream_leases (
  child_id uuid primary key references public.child_profiles (id) on delete cascade, -- one session per child
  household_id uuid not null references public.households (id) on delete cascade,
  device_id text not null,
  heartbeat_at timestamptz not null default now()
);
create index stream_leases_household on public.stream_leases (household_id, heartbeat_at);

-- Start or move a child's session; false when the household's streams are all in use.
create or replace function public.acquire_stream(p_household uuid, p_child uuid, p_device text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_ent record;
begin
  select * into v_ent from public.household_entitlements(p_household);
  if not v_ent.family then return false; end if;
  perform pg_advisory_xact_lock(hashtext(p_household::text));
  if (select count(*) from public.stream_leases l
      where l.household_id = p_household and l.child_id <> p_child
        and l.heartbeat_at > now() - interval '90 seconds') >= v_ent.concurrent_streams then
    return false;
  end if;
  insert into public.stream_leases (child_id, household_id, device_id, heartbeat_at)
  values (p_child, p_household, p_device, now())
  on conflict (child_id) do update set device_id = excluded.device_id, heartbeat_at = now(), household_id = excluded.household_id;
  return true;
end;
$$;

revoke all on function public.acquire_stream(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.household_entitlements(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.plan_settings enable row level security;
alter table public.household_subscriptions enable row level security;
alter table public.narrator_activations enable row level security;
alter table public.stream_leases enable row level security;

create policy "public plan settings" on public.plan_settings for select using (true);
create policy "members read their subscription" on public.household_subscriptions
  for select using (public.is_active_member(auth.uid(), household_id));
create policy "members read their narrators" on public.narrator_activations
  for select using (public.is_active_member(auth.uid(), household_id));
-- stream_leases: service role only.
