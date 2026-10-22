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
  if p_preview is null then
    if not exists (select 1 from public.voice_profiles where owner_id = p_contributor and status = 'ready') then
      raise exception 'no ready voice' using errcode = 'check_violation';
    end if;
  elsif not exists (
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



revoke all on function public.send_voice_invitations(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
