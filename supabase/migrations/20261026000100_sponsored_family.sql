insert into public.feature_flags (key, enabled, description) values
  ('sponsored_family', false, 'Grandparent-sponsored Readli Family for up to two households. Off until real Stripe and recipient tests pass')
on conflict (key) do nothing;

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid references auth.users (id) on delete set null,
  plan text not null check (plan in ('monthly', 'annual')),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'scheduled', 'active', 'past_due', 'canceling', 'ended', 'refunded')),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'usd',
  max_households smallint not null default 2 check (max_households between 1 and 2),
  monthly_credits integer not null default 40 check (monthly_credits >= 0),
  giver_display_name text not null check (char_length(giver_display_name) <= 120),
  message text check (char_length(message) <= 300),
  preview_id uuid references public.voice_previews (id) on delete set null,
  consent_receipt_id uuid references public.consent_receipts (id),
  deliver_at timestamptz not null,
  delivered_at timestamptz,
  starts_at timestamptz,
  paid_through timestamptz,
  ends_at timestamptz,
  cancel_requested_at timestamptz,
  provider_customer_ref text,
  provider_payment_ref text,
  provider_subscription_ref text,
  livemode boolean not null default false,
  refund_state text not null default 'none' check (refund_state in ('none', 'pending', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_through is null or starts_at is null or paid_through > starts_at)
);
create unique index if not exists sponsorships_payment_ref on public.sponsorships (provider_payment_ref) where provider_payment_ref is not null;
create unique index if not exists sponsorships_subscription_ref on public.sponsorships (provider_subscription_ref) where provider_subscription_ref is not null;
create index if not exists sponsorships_sponsor on public.sponsorships (sponsor_id);
create index if not exists sponsorships_delivery_due on public.sponsorships (deliver_at) where delivered_at is null and status = 'scheduled';

create table if not exists public.sponsorship_seats (
  id uuid primary key default gen_random_uuid(),
  sponsorship_id uuid not null references public.sponsorships (id) on delete cascade,
  seat smallint not null check (seat between 1 and 2),
  recipient_name text not null check (char_length(recipient_name) <= 120),
  share_voice boolean not null,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'removal_scheduled', 'removed', 'left', 'converted', 'canceled')),
  household_id uuid references public.households (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  credit_share integer not null default 20 check (credit_share >= 0),
  next_credit_share integer check (next_credit_share >= 0),
  next_credits_from timestamptz,
  removal_requested_at timestamptz,
  access_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sponsorship_seats_one_live
  on public.sponsorship_seats (sponsorship_id, seat) where status in ('invited', 'active', 'removal_scheduled');
create index if not exists sponsorship_seats_household on public.sponsorship_seats (household_id) where household_id is not null;

create table if not exists public.sponsorship_invitations (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.sponsorship_seats (id) on delete cascade,
  token_hash text not null unique,
  recipient_email_hash text not null,
  recipient_email_encrypted text,
  sent_at timestamptz,
  sent_count integer not null default 0 check (sent_count >= 0),
  expires_at timestamptz not null,
  opened_at timestamptz,
  preview_played_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);
create index if not exists sponsorship_invitations_seat on public.sponsorship_invitations (seat_id);

create trigger sponsorships_updated before update on public.sponsorships
  for each row execute function public.set_updated_at();
create trigger sponsorship_seats_updated before update on public.sponsorship_seats
  for each row execute function public.set_updated_at();

alter table public.household_entitlements drop constraint if exists household_entitlements_source_check;
alter table public.household_entitlements add constraint household_entitlements_source_check
  check (source in ('subscription', 'gift', 'donated', 'trial', 'tester', 'sponsored'));
alter table public.household_entitlements
  add column if not exists sponsorship_id uuid references public.sponsorships (id) on delete set null,
  add column if not exists sponsor_user_id uuid references auth.users (id) on delete set null,
  add column if not exists monthly_credits integer check (monthly_credits >= 0),
  add column if not exists next_monthly_credits integer check (next_monthly_credits >= 0),
  add column if not exists next_credits_from timestamptz,
  add column if not exists included_narrator_slots integer check (included_narrator_slots >= 0),
  add column if not exists included_streams integer check (included_streams >= 0),
  add column if not exists max_child_profiles integer check (max_child_profiles >= 0);
create unique index if not exists household_entitlements_one_sponsored
  on public.household_entitlements (household_id) where source = 'sponsored' and status = 'active';

alter table public.consent_receipts drop constraint if exists consent_receipts_purpose_check;
alter table public.consent_receipts add constraint consent_receipts_purpose_check
  check (purpose in ('guest_demo_processing', 'voice_persistence', 'premium_voice', 'narrator_public', 'voice_invitation', 'sponsored_voice_share'));

alter table public.permission_audit_log drop constraint if exists permission_audit_log_action_check;
alter table public.permission_audit_log add constraint permission_audit_log_action_check check (action in (
  'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
  'narration_authorized', 'narration_denied', 'narration_requested', 'narration_canceled',
  'narrator_activated', 'narrator_released', 'narrator_slot_added', 'child_profile_created',
  'child_profile_removed', 'entitlement_granted', 'credits_purchased', 'sponsorship_joined', 'sponsorship_ended'
));

alter table public.revenue_events drop constraint if exists revenue_events_kind_check;
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.revenue_events'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%billing_interval IS NOT NULL%'
  loop
    execute format('alter table public.revenue_events drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table public.revenue_events add constraint revenue_events_kind_check
  check (kind in ('subscription', 'narrator_slot', 'credit_pack', 'gift', 'sponsorship'));
alter table public.revenue_events add constraint revenue_events_interval_check
  check ((kind in ('subscription', 'narrator_slot', 'sponsorship')) = (billing_interval is not null));
alter table public.revenue_events add column if not exists sponsorship_id uuid references public.sponsorships (id) on delete set null;

create or replace function public.narrator_slot_count(p_household uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(e.included_narrator_slots, (select included_narrator_slots from plan_settings)) + e.extra_narrator_slots
                   from household_entitlements e
                   where e.household_id = p_household and e.status = 'active'
                     and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
                   order by e.starts_at limit 1), 0);
$$;

create or replace function public.sponsor_voice_included(p_voice uuid, p_household uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from household_entitlements e
    join voice_profiles v on v.id = p_voice and v.owner_id = e.sponsor_user_id
    where e.household_id = p_household and e.source = 'sponsored' and e.status = 'active'
      and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
  );
$$;

create or replace function public.active_slot_started(p_voice uuid, p_household uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select a.activated_at
  from narrator_slot_assignments a
  where a.household_id = p_household and a.voice_id = p_voice and a.released_at is null
    and public.active_share_started(a.voice_id, p_household) is not null
    and (
      public.sponsor_voice_included(a.voice_id, p_household)
      or a.id in (
        select c.id from narrator_slot_assignments c
        where c.household_id = p_household and c.released_at is null
          and public.active_share_started(c.voice_id, p_household) is not null
          and not public.sponsor_voice_included(c.voice_id, p_household)
        order by c.activated_at
        limit public.narrator_slot_count(p_household)
      )
    );
$$;

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
  if public.sponsor_voice_included(new.voice_id, new.household_id) then
    return new;
  end if;
  if (select count(*) from narrator_slot_assignments a
      where a.household_id = new.household_id and a.released_at is null
        and public.active_share_started(a.voice_id, new.household_id) is not null
        and not public.sponsor_voice_included(a.voice_id, new.household_id))
     >= public.narrator_slot_count(new.household_id) then
    raise exception 'no free narrator slot' using errcode = '53400';
  end if;
  return new;
end;
$$;

create or replace function public.guard_child_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max integer;
begin
  select coalesce(e.max_child_profiles, (select max_child_profiles from plan_settings)) into v_max
  from household_entitlements e
  where e.household_id = new.household_id and e.status = 'active'
    and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
  order by e.starts_at limit 1;
  if v_max is null then
    raise exception 'kids profiles need Readli Family' using errcode = '42501';
  end if;
  if (select count(*) from child_profiles where household_id = new.household_id and deleted_at is null) >= v_max then
    raise exception 'child profile limit reached' using errcode = '53400';
  end if;
  return new;
end;
$$;

create or replace function public.guard_listening_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
begin
  select coalesce(e.included_streams, (select included_concurrent_streams from plan_settings))
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

create or replace function public.sponsored_access_end(p_sponsorship uuid, p_seat uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when s.status in ('ended', 'refunded') then least(coalesce(s.ends_at, now()), coalesce(t.access_until, 'infinity'::timestamptz))
    when s.plan = 'annual' or s.status = 'canceling' then least(coalesce(s.ends_at, s.paid_through), coalesce(t.access_until, 'infinity'::timestamptz))
    else t.access_until
  end
  from sponsorships s join sponsorship_seats t on t.sponsorship_id = s.id
  where s.id = p_sponsorship and t.id = p_seat;
$$;

create or replace function public.sync_sponsorship(p_sponsorship uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_seat record;
  v_end timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('sponsorship:' || p_sponsorship::text));
  for v_seat in
    select t.* from sponsorship_seats t
    where t.sponsorship_id = p_sponsorship and t.household_id is not null and t.status in ('active', 'removal_scheduled', 'removed', 'canceled')
  loop
    v_end := public.sponsored_access_end(p_sponsorship, v_seat.id);
    update household_entitlements e
    set ends_at = v_end,
        status = case when v_end is not null and v_end <= now() then 'canceled' else 'active' end,
        monthly_credits = v_seat.credit_share,
        next_monthly_credits = v_seat.next_credit_share,
        next_credits_from = v_seat.next_credits_from
    where e.sponsorship_id = p_sponsorship and e.household_id = v_seat.household_id and e.source = 'sponsored'
      and (e.status = 'active' or e.ends_at is distinct from v_end);
    if v_end is not null and v_end <= now() and v_seat.status in ('active', 'removal_scheduled') then
      update sponsorship_seats set status = case when v_seat.status = 'removal_scheduled' then 'removed' else 'canceled' end
      where id = v_seat.id;
      insert into permission_audit_log (actor, action, household_id, detail)
      values ('system', 'sponsorship_ended', v_seat.household_id, 'sponsorship ' || p_sponsorship::text);
    end if;
  end loop;
end;
$$;
revoke all on function public.sync_sponsorship(uuid) from public, anon, authenticated;

create or replace function public.accept_sponsored_invitation(p_token_hash text, p_user uuid, p_household uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.sponsorship_invitations;
  v_seat public.sponsorship_seats;
  v_sp public.sponsorships;
  v_voice public.voice_profiles;
  v_policy text;
begin
  select * into v_inv from sponsorship_invitations where token_hash = p_token_hash for update;
  if not found or v_inv.revoked_at is not null then return 'invalid'; end if;
  select * into v_seat from sponsorship_seats where id = v_inv.seat_id for update;
  if v_inv.accepted_at is not null then
    return case when v_seat.household_id = p_household then 'accepted' else 'invalid' end;
  end if;
  if v_inv.expires_at <= now() then return 'expired'; end if;
  if v_seat.status <> 'invited' then return 'invalid'; end if;
  select * into v_sp from sponsorships where id = v_seat.sponsorship_id for update;
  if v_sp.status not in ('active', 'past_due') or v_sp.delivered_at is null then return 'not_ready'; end if;
  if v_sp.sponsor_id is null then return 'invalid'; end if;
  if v_sp.sponsor_id = p_user then return 'self'; end if;
  if not exists (select 1 from household_members where household_id = p_household and user_id = p_user and role = 'guardian' and removed_at is null) then
    return 'not_guardian';
  end if;
  if exists (select 1 from household_entitlements where household_id = p_household and source = 'sponsored' and status = 'active') then
    return 'already_sponsored';
  end if;
  if exists (select 1 from household_entitlements where household_id = p_household and source <> 'sponsored' and status = 'active'
             and starts_at <= now() and (ends_at is null or ends_at > now())) then
    return 'has_plan';
  end if;

  insert into household_members (household_id, user_id, role)
  values (p_household, v_sp.sponsor_id, 'member')
  on conflict (household_id, user_id) do update set removed_at = null, joined_at = now()
    where public.household_members.removed_at is not null;

  insert into household_entitlements (
    household_id, source, status, starts_at, ends_at, sponsorship_id, sponsor_user_id,
    monthly_credits, next_monthly_credits, next_credits_from, included_narrator_slots, included_streams, max_child_profiles
  ) values (
    p_household, 'sponsored', 'active', least(coalesce(v_sp.starts_at, now()), now()), null, v_sp.id, v_sp.sponsor_id,
    v_seat.credit_share, v_seat.next_credit_share, v_seat.next_credits_from, 1, 2, 6
  );

  if v_seat.share_voice then
    select * into v_voice from voice_profiles where owner_id = v_sp.sponsor_id and status = 'ready' and deleted_at is null
    order by created_at desc limit 1;
    if found then
      select policy_version into v_policy from consent_receipts where id = v_sp.consent_receipt_id and revoked_at is null;
      if found then
        if not exists (select 1 from voice_household_shares where voice_id = v_voice.id and household_id = p_household and revoked_at is null) then
          insert into voice_household_shares (voice_id, household_id, granted_by, policy_version)
          values (v_voice.id, p_household, v_sp.sponsor_id, v_policy);
          insert into permission_audit_log (actor, action, voice_id, household_id, detail)
          values (v_sp.sponsor_id::text, 'voice_shared', v_voice.id, p_household, 'sponsorship ' || v_sp.id::text);
        end if;
        if not exists (select 1 from narrator_slot_assignments where voice_id = v_voice.id and household_id = p_household and released_at is null) then
          insert into narrator_slot_assignments (household_id, voice_id, activated_by)
          values (p_household, v_voice.id, p_user);
          insert into permission_audit_log (actor, action, voice_id, household_id, detail)
          values (p_user::text, 'narrator_activated', v_voice.id, p_household, 'included with sponsorship ' || v_sp.id::text);
        end if;
      end if;
    end if;
  end if;

  update sponsorship_seats set status = 'active', household_id = p_household, accepted_by = p_user, accepted_at = now() where id = v_seat.id;
  update sponsorship_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
  insert into permission_audit_log (actor, action, household_id, detail)
  values (p_user::text, 'sponsorship_joined', p_household, 'sponsorship ' || v_sp.id::text);
  perform public.sync_sponsorship(v_sp.id);
  return 'accepted';
end;
$$;
revoke all on function public.accept_sponsored_invitation(text, uuid, uuid) from public, anon, authenticated;

alter table public.sponsorships enable row level security;
alter table public.sponsorship_seats enable row level security;
alter table public.sponsorship_invitations enable row level security;

create policy sponsorships_sponsor_read on public.sponsorships for select
  using (sponsor_id = auth.uid());
create policy seats_sponsor_read on public.sponsorship_seats for select
  using (exists (select 1 from public.sponsorships s where s.id = sponsorship_id and s.sponsor_id = auth.uid()));
create policy seats_guardian_read on public.sponsorship_seats for select
  using (household_id is not null and exists (
    select 1 from public.household_members m
    where m.household_id = sponsorship_seats.household_id and m.user_id = auth.uid() and m.role = 'guardian' and m.removed_at is null
  ));
