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
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
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
