alter table public.household_invitations
  add column if not exists invitee_role text not null default 'member' check (invitee_role in ('member', 'guardian'));

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
  if v_inv.invitee_role = 'guardian' and exists (
    select 1 from public.household_members
    where user_id = p_user and role = 'guardian' and removed_at is null and household_id <> v_inv.household_id
  ) then
    raise exception 'already a parent in another family' using errcode = 'unique_violation';
  end if;
  select * into v_member from public.household_members
  where household_id = v_inv.household_id and user_id = p_user;
  if found and v_member.removed_at is null and not (v_inv.invitee_role = 'guardian' and v_member.role = 'member') then
    raise exception 'already a member of this family' using errcode = 'unique_violation';
  end if;
  if found then
    update public.household_members
    set role = v_inv.invitee_role,
        relationship_label = coalesce(v_inv.relationship_label, case when v_member.removed_at is null then v_member.relationship_label end),
        joined_at = case when v_member.removed_at is null then v_member.joined_at else now() end,
        removed_at = null
    where household_id = v_inv.household_id and user_id = p_user;
  else
    insert into public.household_members (household_id, user_id, role, relationship_label)
    values (v_inv.household_id, p_user, v_inv.invitee_role, v_inv.relationship_label);
  end if;
  if v_inv.invitee_role = 'guardian' then
    insert into public.child_guardians (child_id, user_id)
    select c.id, p_user from public.child_profiles c
    where c.household_id = v_inv.household_id and c.deleted_at is null
    on conflict (child_id, user_id) do update set removed_at = null, added_at = now();
  end if;
  update public.household_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
  return v_inv.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text, uuid) from public, anon, authenticated;
