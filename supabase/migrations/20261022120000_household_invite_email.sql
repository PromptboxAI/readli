alter table public.household_invitations
  add column if not exists recipient_email_encrypted text,
  add column if not exists sent_count integer not null default 0 check (sent_count >= 0),
  add column if not exists last_sent_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists reported_at timestamptz;

create table if not exists public.household_invitation_sends (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.household_invitations (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  delivery text not null default 'queued' check (delivery in ('queued', 'sent', 'failed')),
  provider_message_id text
);
create index if not exists household_invitation_sends_inviter_time on public.household_invitation_sends (inviter_id, sent_at);
alter table public.household_invitation_sends enable row level security;

alter table public.voice_invitation_reports
  add column if not exists household_invitation_id uuid references public.household_invitations (id) on delete set null;

create or replace function public.send_household_invitation(p_inviter uuid, p_invitation uuid, p_token_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.voice_invitation_settings;
  v_inv public.household_invitations;
  v_today integer;
begin
  perform pg_advisory_xact_lock(hashtext('voice_invitations:' || p_inviter::text));
  select * into v_settings from public.voice_invitation_settings where id;
  if not found or not v_settings.sending_enabled then return 'switched_off'; end if;
  select * into v_inv from public.household_invitations where id = p_invitation for update;
  if not found or v_inv.recipient_email_hash is null or v_inv.recipient_email_encrypted is null then return 'not_found'; end if;
  if not exists (select 1 from public.household_members where household_id = v_inv.household_id and user_id = p_inviter and role = 'guardian' and removed_at is null) then
    return 'not_found';
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.declined_at is not null or v_inv.reported_at is not null then
    return 'closed';
  end if;
  if exists (select 1 from public.email_suppressions where email_hash = v_inv.recipient_email_hash and (contributor_id is null or contributor_id = p_inviter)) then
    return 'suppressed';
  end if;
  if v_inv.sent_count > v_settings.max_resends then return 'resend_limit'; end if;
  select (select count(*) from public.voice_invitation_sends where contributor_id = p_inviter and sent_at > now() - interval '24 hours')
       + (select count(*) from public.household_invitation_sends where inviter_id = p_inviter and sent_at > now() - interval '24 hours')
  into v_today;
  if v_today >= v_settings.max_recipients_per_day then return 'daily_limit'; end if;
  update public.household_invitations
  set token_hash = p_token_hash, sent_count = sent_count + 1, last_sent_at = now(),
      expires_at = greatest(expires_at, now() + make_interval(days => v_settings.link_days))
  where id = p_invitation;
  insert into public.household_invitation_sends (invitation_id, inviter_id) values (p_invitation, p_inviter);
  return 'sent';
end;
$$;

revoke all on function public.send_household_invitation(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.accept_household_invitation(p_token_hash text, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.household_invitations;
  v_member public.household_members;
begin
  select * into v_inv from public.household_invitations
  where token_hash = p_token_hash
  for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.declined_at is not null
     or v_inv.reported_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation is not valid' using errcode = 'check_violation';
  end if;
  select * into v_member from public.household_members
  where household_id = v_inv.household_id and user_id = p_user;
  if found and v_member.removed_at is null then
    raise exception 'already a member of this family' using errcode = 'unique_violation';
  end if;
  if found then
    update public.household_members
    set role = 'member', relationship_label = v_inv.relationship_label, removed_at = null, joined_at = now()
    where household_id = v_inv.household_id and user_id = p_user;
  else
    insert into public.household_members (household_id, user_id, role, relationship_label)
    values (v_inv.household_id, p_user, 'member', v_inv.relationship_label);
  end if;
  update public.household_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
  return v_inv.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text, uuid) from public, anon, authenticated;
