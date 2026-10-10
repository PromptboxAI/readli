-- Household plan and narrator slots (Final Signup Architecture and Subscription Pricing amendment).
--
-- Readli Family households pay; Readli Voice contributors never do. A voice now reaches a child
-- only when all three hold: the owner shared it with the household, the household activated it
-- into a narrator slot it is entitled to, and a guardian approved it for that child. One
-- voice_profiles row per adult serves every household it is shared with (no duplicate cloning).

-- Admin-configurable plan settings (single row). Prices in cents.
create table public.plan_settings (
  id boolean primary key default true check (id),
  family_monthly_price_cents integer not null default 1499,
  included_narrator_slots integer not null default 2,
  extra_slot_price_cents integer not null default 299,
  extra_slot_price_approved boolean not null default false,
  free_contributor_voices integer not null default 1,
  max_child_profiles integer not null default 6,
  included_concurrent_streams integer not null default 3,
  extra_streams_upgrade_enabled boolean not null default false,
  slot_releases_per_30_days integer not null default 4,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
insert into public.plan_settings default values;

-- Subscriptions, gifted and donated memberships all land here.
create table public.household_entitlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source text not null check (source in ('subscription', 'gift', 'donated')),
  status text not null default 'active' check (status in ('active', 'canceled')),
  extra_narrator_slots integer not null default 0 check (extra_narrator_slots >= 0),
  extra_streams integer not null default 0 check (extra_streams >= 0),
  provider_subscription_ref text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index household_entitlements_household on public.household_entitlements (household_id) where status = 'active';

create table public.narrator_slot_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  activated_by uuid not null references auth.users (id),
  activated_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users (id)
);
create unique index narrator_slot_one_live
  on public.narrator_slot_assignments (household_id, voice_id) where released_at is null;

create table public.listening_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index listening_sessions_one_per_child on public.listening_sessions (child_id) where ended_at is null;

create table public.child_book_progress (
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  book_slug text not null,
  sentence integer not null default 0 check (sentence >= 0),
  voice_id uuid references public.voice_profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (child_id, book_slug)
);

create table public.child_favorites (
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  book_slug text not null,
  created_at timestamptz not null default now(),
  primary key (child_id, book_slug)
);

create trigger household_entitlements_updated before update on public.household_entitlements
  for each row execute function public.set_updated_at();

alter table public.child_voice_approvals drop constraint if exists child_voice_approvals_revoke_reason_check;
alter table public.child_voice_approvals add constraint child_voice_approvals_revoke_reason_check
  check (revoke_reason in ('guardian_removed', 'owner_revoked', 'slot_released', 'voice_deleted'));

alter table public.permission_audit_log drop constraint if exists permission_audit_log_action_check;
alter table public.permission_audit_log add constraint permission_audit_log_action_check check (action in (
  'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
  'narration_authorized', 'narration_denied', 'narrator_activated', 'narrator_released',
  'narrator_slot_added', 'child_profile_created', 'child_profile_removed', 'entitlement_granted'
));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.active_entitlement(p_household uuid) returns public.household_entitlements
language sql stable security definer set search_path = public as $$
  select * from household_entitlements
  where household_id = p_household and status = 'active'
    and starts_at <= now() and (ends_at is null or ends_at > now())
  order by starts_at limit 1;
$$;

create or replace function public.narrator_slot_count(p_household uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (select included_narrator_slots from plan_settings) + e.extra_narrator_slots
                   from household_entitlements e
                   where e.household_id = p_household and e.status = 'active'
                     and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
                   order by e.starts_at limit 1), 0);
$$;

-- When a household has fewer slots than live assignments, the earliest activations count.
create or replace function public.active_slot_started(p_voice uuid, p_household uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select activated_at from (
    select a.voice_id, a.activated_at
    from narrator_slot_assignments a
    where a.household_id = p_household and a.released_at is null
      and public.active_share_started(a.voice_id, p_household) is not null
    order by a.activated_at
    limit public.narrator_slot_count(p_household)
  ) live
  where live.voice_id = p_voice;
$$;

-- All three gates, checked together.
create or replace function public.child_can_hear_voice(p_child uuid, p_voice uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from child_profiles c
    join child_voice_approvals a on a.child_id = c.id and a.voice_id = p_voice and a.revoked_at is null
    where c.id = p_child and c.deleted_at is null
      and public.active_share_started(p_voice, c.household_id) is not null
      and public.active_slot_started(p_voice, c.household_id) is not null
      and a.approved_at >= public.active_share_started(p_voice, c.household_id)
      and a.approved_at >= public.active_slot_started(p_voice, c.household_id)
      and public.is_guardian_of(a.approved_by, c.id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.guard_slot_activation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from household_members where household_id = new.household_id and user_id = new.activated_by
                 and role = 'guardian' and removed_at is null) then
    raise exception 'only a guardian can activate narrators' using errcode = '42501';
  end if;
  if public.active_share_started(new.voice_id, new.household_id) is null then
    raise exception 'the voice owner has not shared this voice with the household' using errcode = '42501';
  end if;
  if (select count(*) from narrator_slot_assignments a
      where a.household_id = new.household_id and a.released_at is null
        and public.active_share_started(a.voice_id, new.household_id) is not null)
     >= public.narrator_slot_count(new.household_id) then
    raise exception 'no free narrator slot' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger slot_activation_guard before insert on public.narrator_slot_assignments
  for each row execute function public.guard_slot_activation();

-- Releasing a slot (or the owner revoking) ends every child approval for that voice in that household.
create or replace function public.cascade_slot_release() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.released_at is null and new.released_at is not null then
    update child_voice_approvals a
    set revoked_at = new.released_at, revoked_by = new.released_by, revoke_reason = coalesce(a.revoke_reason, 'slot_released')
    from child_profiles c
    where a.child_id = c.id and c.household_id = new.household_id
      and a.voice_id = new.voice_id and a.revoked_at is null;
  end if;
  return new;
end;
$$;
create trigger slot_release_cascade after update of released_at on public.narrator_slot_assignments
  for each row execute function public.cascade_slot_release();

create or replace function public.release_slots_on_unshare() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update narrator_slot_assignments set released_at = new.revoked_at, released_by = new.revoked_by
    where household_id = new.household_id and voice_id = new.voice_id and released_at is null;
  end if;
  return new;
end;
$$;
create trigger voice_share_releases_slots after update of revoked_at on public.voice_household_shares
  for each row execute function public.release_slots_on_unshare();

-- Approval now also needs the voice in an active slot.
create or replace function public.guard_child_approval() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_household uuid;
begin
  select household_id into v_household from child_profiles where id = new.child_id and deleted_at is null;
  if v_household is null or not public.is_guardian_of(new.approved_by, new.child_id) then
    raise exception 'only a guardian of this child can approve storytellers' using errcode = '42501';
  end if;
  if public.active_share_started(new.voice_id, v_household) is null then
    raise exception 'the voice owner has not shared this voice with the household' using errcode = '42501';
  end if;
  if public.active_slot_started(new.voice_id, v_household) is null then
    raise exception 'the household has not put this voice in a narrator slot' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Kids profiles need Readli Family; up to max_child_profiles per household; never billed per child.
create or replace function public.guard_child_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from household_entitlements where household_id = new.household_id and status = 'active'
                 and starts_at <= now() and (ends_at is null or ends_at > now())) then
    raise exception 'kids profiles need Readli Family' using errcode = '42501';
  end if;
  if (select count(*) from child_profiles where household_id = new.household_id and deleted_at is null)
     >= (select max_child_profiles from plan_settings) then
    raise exception 'child profile limit reached' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger child_limit_guard before insert on public.child_profiles
  for each row execute function public.guard_child_limit();

-- Concurrent child listening, per household. Stale sessions (no heartbeat for 90s) don't count.
create or replace function public.guard_listening_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
begin
  select (select included_concurrent_streams from plan_settings)
         + case when (select extra_streams_upgrade_enabled from plan_settings) then e.extra_streams else 0 end
  into v_limit
  from household_entitlements e
  where e.household_id = new.household_id and e.status = 'active'
    and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
  order by e.starts_at limit 1;
  if coalesce(v_limit, 0) <= (select count(*) from listening_sessions
      where household_id = new.household_id and child_id <> new.child_id and ended_at is null
        and last_seen_at > now() - interval '90 seconds') then
    raise exception 'concurrent listening limit reached' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger listening_limit_guard before insert on public.listening_sessions
  for each row execute function public.guard_listening_limit();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plan_settings enable row level security;
alter table public.household_entitlements enable row level security;
alter table public.narrator_slot_assignments enable row level security;
alter table public.listening_sessions enable row level security;
alter table public.child_book_progress enable row level security;
alter table public.child_favorites enable row level security;

create policy plan_settings_read on public.plan_settings for select using (true);
create policy entitlements_member_read on public.household_entitlements for select
  using (public.is_active_member(auth.uid(), household_id));
create policy slots_member_read on public.narrator_slot_assignments for select
  using (public.is_active_member(auth.uid(), household_id));
create policy progress_guardian_read on public.child_book_progress for select
  using (public.is_guardian_of(auth.uid(), child_id));
create policy favorites_guardian_read on public.child_favorites for select
  using (public.is_guardian_of(auth.uid(), child_id));
-- Writes go through server route handlers (service role).
