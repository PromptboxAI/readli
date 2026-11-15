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
    v_seat.credit_share, v_seat.next_credit_share, v_seat.next_credits_from, 1, null, 6
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

update public.household_entitlements
set included_streams = null
where source = 'sponsored' and included_streams = 2;
