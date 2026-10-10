-- Family voice permissions and parent approval (Amendment 002, launch-critical).
--
-- A child can hear a family voice only while BOTH keys are valid:
--   1. voice_household_shares: the voice owner shared it with the child's household, and
--   2. child_voice_approvals:  a guardian of that child approved it for that child.
-- Household membership and family-tree relationships grant nothing. Rows are revoked, never
-- deleted, so every grant and revocation stays auditable. The app server checks
-- public.child_can_hear_voice() before generating, returning or playing any narration; the
-- triggers below enforce the same rules in the database so a buggy caller can't bypass them.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('guardian', 'member')),
  -- Display only (Amendment 001 F-8). Never used for permissions.
  relationship_label text,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (household_id, user_id)
);

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  nickname text not null,
  icon text,
  age_band text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.child_guardians (
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (child_id, user_id)
);

-- Voice ownership and identity. The provider voice id never leaves the server.
create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_asset_id uuid,
  clone_type text not null default 'instant' check (clone_type in ('instant', 'professional')),
  provider text not null default 'elevenlabs',
  provider_voice_id_encrypted bytea,
  status text not null default 'processing' check (status in ('processing', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- The owner's consent to create and use their voice (separate from sharing it).
create table public.voice_consents (
  id uuid primary key default gen_random_uuid(),
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  policy_version text not null,
  purposes text[] not null,
  recording_proof_ref text,
  captured_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Key 1: the owner shares with one household.
create table public.voice_household_shares (
  id uuid primary key default gen_random_uuid(),
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  granted_by uuid not null references auth.users (id),
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id)
);
create unique index voice_household_shares_one_live
  on public.voice_household_shares (voice_id, household_id) where revoked_at is null;

-- Key 2: a guardian approves one voice for one child.
create table public.child_voice_approvals (
  id uuid primary key default gen_random_uuid(),
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  approved_by uuid not null references auth.users (id),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id),
  revoke_reason text check (revoke_reason in ('guardian_removed', 'owner_revoked', 'voice_deleted'))
);
create unique index child_voice_approvals_one_live
  on public.child_voice_approvals (voice_id, child_id) where revoked_at is null;

-- Generated narration. Re-authorized on every fetch; revoked_at is set when access ends.
create table public.narration_assets (
  id uuid primary key default gen_random_uuid(),
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  child_id uuid references public.child_profiles (id) on delete cascade,
  book_slug text not null,
  segment_start integer not null,
  segment_end integer not null,
  storage_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

-- Append-only audit trail for every grant, revocation and narration decision.
create table public.permission_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null check (action in (
    'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
    'narration_authorized', 'narration_denied'
  )),
  voice_id uuid,
  child_id uuid,
  household_id uuid,
  detail text
);

create trigger households_updated before update on public.households
  for each row execute function public.set_updated_at();
create trigger voice_profiles_updated before update on public.voice_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permission functions
-- ---------------------------------------------------------------------------

create or replace function public.is_active_member(p_user uuid, p_household uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members
    where user_id = p_user and household_id = p_household and removed_at is null
  );
$$;

create or replace function public.is_guardian_of(p_user uuid, p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from child_profiles c
    join child_guardians g on g.child_id = c.id and g.user_id = p_user and g.removed_at is null
    join household_members m on m.household_id = c.household_id and m.user_id = p_user
      and m.role = 'guardian' and m.removed_at is null
    where c.id = p_child and c.deleted_at is null
  );
$$;

create or replace function public.active_share_started(p_voice uuid, p_household uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select s.granted_at
  from voice_household_shares s
  join voice_profiles v on v.id = s.voice_id
  where s.voice_id = p_voice and s.household_id = p_household and s.revoked_at is null
    and s.granted_by = v.owner_id
    and v.status = 'ready' and v.deleted_at is null
    and public.is_active_member(v.owner_id, p_household);
$$;

-- Both keys, checked together. The only question the app asks before any narration.
create or replace function public.child_can_hear_voice(p_child uuid, p_voice uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from child_profiles c
    join child_voice_approvals a on a.child_id = c.id and a.voice_id = p_voice and a.revoked_at is null
    where c.id = p_child and c.deleted_at is null
      and public.active_share_started(p_voice, c.household_id) is not null
      and a.approved_at >= public.active_share_started(p_voice, c.household_id)
      and public.is_guardian_of(a.approved_by, c.id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Database-level guards
-- ---------------------------------------------------------------------------

-- Only the voice's own owner, as a member of that household, can share it.
create or replace function public.guard_voice_share() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from voice_profiles where id = new.voice_id and owner_id = new.granted_by
                 and status = 'ready' and deleted_at is null) then
    raise exception 'only the voice owner can share a ready voice' using errcode = '42501';
  end if;
  if not public.is_active_member(new.granted_by, new.household_id) then
    raise exception 'voice owner is not a member of this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger voice_share_guard before insert on public.voice_household_shares
  for each row execute function public.guard_voice_share();

-- Turning a share off revokes every approval for that household's children, so sharing again
-- starts disabled for every child.
create or replace function public.cascade_share_revocation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update child_voice_approvals a
    set revoked_at = new.revoked_at, revoked_by = new.revoked_by, revoke_reason = 'owner_revoked'
    from child_profiles c
    where a.child_id = c.id and c.household_id = new.household_id
      and a.voice_id = new.voice_id and a.revoked_at is null;
    update narration_assets n
    set revoked_at = new.revoked_at
    from child_profiles c
    where n.child_id = c.id and c.household_id = new.household_id
      and n.voice_id = new.voice_id and n.revoked_at is null;
  end if;
  return new;
end;
$$;
create trigger voice_share_revocation after update of revoked_at on public.voice_household_shares
  for each row execute function public.cascade_share_revocation();

-- A guardian can approve only a voice its owner has shared with the child's household.
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
  return new;
end;
$$;
create trigger child_approval_guard before insert on public.child_voice_approvals
  for each row execute function public.guard_child_approval();

-- A guardian removing an approval also cuts off that child's existing audio in that voice.
create or replace function public.cascade_approval_revocation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update narration_assets set revoked_at = new.revoked_at
    where child_id = new.child_id and voice_id = new.voice_id and revoked_at is null;
  end if;
  return new;
end;
$$;
create trigger child_approval_revocation after update of revoked_at on public.child_voice_approvals
  for each row execute function public.cascade_approval_revocation();

create or replace function public.forbid_audit_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'permission_audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger audit_append_only before update or delete on public.permission_audit_log
  for each row execute function public.forbid_audit_changes();

-- ---------------------------------------------------------------------------
-- Row level security. The service role (server route handlers) bypasses RLS; these policies
-- cover signed-in adults reading through the anon key. Children never have database identities.
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.child_profiles enable row level security;
alter table public.child_guardians enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.voice_consents enable row level security;
alter table public.voice_household_shares enable row level security;
alter table public.child_voice_approvals enable row level security;
alter table public.narration_assets enable row level security;
alter table public.permission_audit_log enable row level security;

create policy households_member_read on public.households for select
  using (public.is_active_member(auth.uid(), id));
create policy members_member_read on public.household_members for select
  using (public.is_active_member(auth.uid(), household_id));
create policy children_guardian_read on public.child_profiles for select
  using (public.is_guardian_of(auth.uid(), id));
create policy guardians_guardian_read on public.child_guardians for select
  using (public.is_guardian_of(auth.uid(), child_id));

-- Owners see their own voices; household members see only voices actively shared with them.
create policy voices_owner_read on public.voice_profiles for select
  using (owner_id = auth.uid());
create policy voices_shared_read on public.voice_profiles for select
  using (exists (
    select 1 from public.voice_household_shares s
    where s.voice_id = voice_profiles.id and s.revoked_at is null and public.is_active_member(auth.uid(), s.household_id)
  ));
create policy consents_owner_read on public.voice_consents for select
  using (owner_id = auth.uid());

-- Key 1 belongs to the owner alone.
create policy shares_owner_all on public.voice_household_shares for all
  using (granted_by = auth.uid()) with check (granted_by = auth.uid());
create policy shares_member_read on public.voice_household_shares for select
  using (public.is_active_member(auth.uid(), household_id));

-- Key 2 belongs to the child's guardians alone. Owners can read who their voice is approved for.
create policy approvals_guardian_all on public.child_voice_approvals for all
  using (public.is_guardian_of(auth.uid(), child_id))
  with check (approved_by = auth.uid() and public.is_guardian_of(auth.uid(), child_id));
create policy approvals_owner_read on public.child_voice_approvals for select
  using (exists (select 1 from public.voice_profiles v where v.id = voice_id and v.owner_id = auth.uid()));

-- narration_assets and permission_audit_log: service role only (no policies).
