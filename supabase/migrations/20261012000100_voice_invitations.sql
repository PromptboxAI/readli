insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('voice-previews', 'voice-previews', false, 5242880, array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'])
on conflict (id) do nothing;

alter table public.consent_receipts drop constraint if exists consent_receipts_purpose_check;
alter table public.consent_receipts add constraint consent_receipts_purpose_check
  check (purpose in ('guest_demo_processing', 'voice_persistence', 'premium_voice', 'narrator_public', 'voice_invitation'));

create table if not exists public.voice_invitation_settings (
  id boolean primary key default true check (id),
  sending_enabled boolean not null default false,
  max_recipients_per_send integer not null default 10 check (max_recipients_per_send between 1 and 50),
  max_recipients_per_day integer not null default 30 check (max_recipients_per_day between 1 and 500),
  max_resends integer not null default 3 check (max_resends between 0 and 10),
  link_days integer not null default 14 check (link_days between 1 and 60),
  preview_generations_per_30_days integer not null default 5 check (preview_generations_per_30_days between 1 and 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.voice_invitation_settings default values on conflict (id) do nothing;

create table if not exists public.voice_previews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  voice_version integer not null,
  book_slug text not null,
  passage_id text not null,
  characters integer not null check (characters > 0),
  storage_key text not null unique,
  content_type text not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  retired_at timestamptz
);
create unique index if not exists voice_previews_one_approved on public.voice_previews (owner_id)
  where approved_at is not null and retired_at is null;
create index if not exists voice_previews_owner_time on public.voice_previews (owner_id, created_at);

create table if not exists public.voice_invitations (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references auth.users (id) on delete cascade,
  preview_id uuid references public.voice_previews (id) on delete set null,
  consent_receipt_id uuid not null references public.consent_receipts (id),
  recipient_email_hash text not null,
  recipient_email_encrypted text,
  recipient_name text check (char_length(recipient_name) <= 80),
  relationship_label text check (char_length(relationship_label) <= 40),
  message text check (char_length(message) <= 500),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  sent_count integer not null default 1 check (sent_count >= 1),
  expires_at timestamptz not null,
  opened_at timestamptz,
  played_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  household_id uuid references public.households (id) on delete set null,
  trial_started_at timestamptz,
  converted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  reported_at timestamptz,
  check (accepted_at is null or declined_at is null)
);
create unique index if not exists voice_invitations_one_open on public.voice_invitations (contributor_id, recipient_email_hash)
  where accepted_at is null and declined_at is null and revoked_at is null;
create index if not exists voice_invitations_contributor on public.voice_invitations (contributor_id, created_at);
create index if not exists voice_invitations_household on public.voice_invitations (household_id) where household_id is not null;

create table if not exists public.voice_invitation_sends (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.voice_invitations (id) on delete cascade,
  contributor_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  delivery text not null default 'queued' check (delivery in ('queued', 'sent', 'failed')),
  provider_message_id text
);
create index if not exists voice_invitation_sends_contributor_time on public.voice_invitation_sends (contributor_id, sent_at);

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  contributor_id uuid references auth.users (id) on delete cascade,
  reason text not null check (reason in ('unsubscribed', 'declined', 'reported', 'bounced', 'complained')),
  invitation_id uuid references public.voice_invitations (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists email_suppressions_once on public.email_suppressions (email_hash, contributor_id) nulls not distinct;

create table if not exists public.voice_invitation_reports (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.voice_invitations (id) on delete set null,
  contributor_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('spam', 'dont_know', 'inappropriate', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

alter table public.voice_invitation_settings enable row level security;
alter table public.voice_previews enable row level security;
alter table public.voice_invitations enable row level security;
alter table public.voice_invitation_sends enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.voice_invitation_reports enable row level security;

create or replace function public.send_voice_invitations(p_contributor uuid, p_preview uuid, p_consent uuid, p_recipients jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.voice_invitation_settings;
  v_sent_today integer;
  v_seen text[] := '{}';
  v_out jsonb := '[]'::jsonb;
  v_r jsonb;
  v_hash text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('voice_invitations:' || p_contributor::text));
  select * into v_settings from public.voice_invitation_settings where id;
  if not v_settings.sending_enabled then
    raise exception 'invitations are switched off' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_recipients) > v_settings.max_recipients_per_send then
    raise exception 'too many recipients' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.voice_previews p
    join public.voice_profiles v on v.id = p.voice_id
    where p.id = p_preview and p.owner_id = p_contributor and p.approved_at is not null and p.retired_at is null
      and v.status = 'ready' and v.version = p.voice_version
  ) then
    raise exception 'no approved preview' using errcode = 'check_violation';
  end if;
  select count(*) into v_sent_today from public.voice_invitation_sends
  where contributor_id = p_contributor and sent_at > now() - interval '24 hours';

  for v_r in select * from jsonb_array_elements(p_recipients) loop
    v_hash := v_r->>'email_hash';
    if v_hash = any(v_seen) then
      v_out := v_out || jsonb_build_object('email_hash', v_hash, 'result', 'duplicate');
      continue;
    end if;
    v_seen := v_seen || v_hash;
    if exists (select 1 from public.email_suppressions where email_hash = v_hash and (contributor_id is null or contributor_id = p_contributor)) then
      v_out := v_out || jsonb_build_object('email_hash', v_hash, 'result', 'suppressed');
      continue;
    end if;
    if exists (select 1 from public.voice_invitations where contributor_id = p_contributor and recipient_email_hash = v_hash
               and accepted_at is null and declined_at is null and revoked_at is null) then
      v_out := v_out || jsonb_build_object('email_hash', v_hash, 'result', 'already_invited');
      continue;
    end if;
    if v_sent_today >= v_settings.max_recipients_per_day then
      v_out := v_out || jsonb_build_object('email_hash', v_hash, 'result', 'daily_limit');
      continue;
    end if;
    insert into public.voice_invitations (contributor_id, preview_id, consent_receipt_id, recipient_email_hash, recipient_email_encrypted,
      recipient_name, relationship_label, message, token_hash, expires_at)
    values (p_contributor, p_preview, p_consent, v_hash, v_r->>'email_encrypted', nullif(v_r->>'name', ''), nullif(v_r->>'relationship', ''),
      nullif(v_r->>'message', ''), v_r->>'token_hash', now() + make_interval(days => v_settings.link_days))
    returning id into v_id;
    insert into public.voice_invitation_sends (invitation_id, contributor_id) values (v_id, p_contributor);
    v_sent_today := v_sent_today + 1;
    v_out := v_out || jsonb_build_object('email_hash', v_hash, 'result', 'created', 'id', v_id);
  end loop;
  return v_out;
end;
$$;

create or replace function public.resend_voice_invitation(p_contributor uuid, p_invitation uuid, p_token_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.voice_invitation_settings;
  v_inv public.voice_invitations;
begin
  perform pg_advisory_xact_lock(hashtext('voice_invitations:' || p_contributor::text));
  select * into v_settings from public.voice_invitation_settings where id;
  if not v_settings.sending_enabled then return 'switched_off'; end if;
  select * into v_inv from public.voice_invitations where id = p_invitation and contributor_id = p_contributor for update;
  if not found then return 'not_found'; end if;
  if v_inv.accepted_at is not null or v_inv.declined_at is not null or v_inv.revoked_at is not null or v_inv.reported_at is not null then
    return 'closed';
  end if;
  if exists (select 1 from public.email_suppressions where email_hash = v_inv.recipient_email_hash and (contributor_id is null or contributor_id = p_contributor)) then
    return 'suppressed';
  end if;
  if v_inv.sent_count - 1 >= v_settings.max_resends then return 'resend_limit'; end if;
  if (select count(*) from public.voice_invitation_sends where contributor_id = p_contributor and sent_at > now() - interval '24 hours')
     >= v_settings.max_recipients_per_day then
    return 'daily_limit';
  end if;
  update public.voice_invitations
  set token_hash = p_token_hash, sent_count = sent_count + 1, last_sent_at = now(),
      expires_at = now() + make_interval(days => v_settings.link_days)
  where id = p_invitation;
  insert into public.voice_invitation_sends (invitation_id, contributor_id) values (p_invitation, p_contributor);
  return 'resent';
end;
$$;

create or replace function public.accept_voice_invitation(p_token_hash text, p_user uuid, p_household uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.voice_invitations;
  v_voice public.voice_profiles;
  v_policy text;
begin
  select * into v_inv from public.voice_invitations where token_hash = p_token_hash for update;
  if not found or v_inv.revoked_at is not null or v_inv.declined_at is not null or v_inv.reported_at is not null then
    return 'invalid';
  end if;
  if v_inv.accepted_at is not null then
    return case when v_inv.household_id = p_household then 'accepted' else 'invalid' end;
  end if;
  if v_inv.expires_at <= now() then return 'expired'; end if;
  if v_inv.contributor_id = p_user then return 'self'; end if;
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = p_user and role = 'guardian' and removed_at is null) then
    return 'not_guardian';
  end if;
  select * into v_voice from public.voice_profiles where owner_id = v_inv.contributor_id and status = 'ready' order by created_at desc limit 1;
  if not found then return 'no_voice'; end if;
  select policy_version into v_policy from public.consent_receipts where id = v_inv.consent_receipt_id and revoked_at is null;
  if not found then return 'invalid'; end if;

  insert into public.household_members (household_id, user_id, role)
  values (p_household, v_inv.contributor_id, 'member')
  on conflict (household_id, user_id) do update set removed_at = null, joined_at = now()
    where public.household_members.removed_at is not null;
  if not exists (select 1 from public.voice_household_shares where voice_id = v_voice.id and household_id = p_household and revoked_at is null) then
    insert into public.voice_household_shares (voice_id, household_id, granted_by, policy_version)
    values (v_voice.id, p_household, v_inv.contributor_id, v_policy);
    insert into public.permission_audit_log (actor, action, voice_id, household_id, detail)
    values (v_inv.contributor_id::text, 'voice_shared', v_voice.id, p_household, 'invitation ' || v_inv.id::text);
  end if;
  update public.voice_invitations set accepted_at = now(), accepted_by = p_user, household_id = p_household where id = v_inv.id;
  return 'accepted';
end;
$$;

revoke all on function public.send_voice_invitations(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.resend_voice_invitation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.accept_voice_invitation(text, uuid, uuid) from public, anon, authenticated;
