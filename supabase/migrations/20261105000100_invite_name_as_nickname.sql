create or replace function public.accept_household_invitation(p_token_hash text, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.household_invitations;
  v_member public.household_members;
  v_nickname text;
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
  v_nickname := case
    when nullif(btrim(v_inv.invitee_name), '') is not null
      and lower(btrim(v_inv.invitee_name)) <> lower(coalesce((select split_part(email, '@', 1) from auth.users where id = p_user), ''))
      and lower(btrim(v_inv.invitee_name)) <> lower(coalesce((select display_name from public.adult_profiles where user_id = p_user), ''))
    then left(btrim(v_inv.invitee_name), 40)
  end;
  if found then
    update public.household_members
    set role = v_inv.invitee_role,
        relationship_label = coalesce(v_inv.relationship_label, case when v_member.removed_at is null then v_member.relationship_label end),
        joined_at = case when v_member.removed_at is null then v_member.joined_at else now() end,
        removed_at = null,
        storyteller_nickname = coalesce(case when v_member.removed_at is null then v_member.storyteller_nickname end, v_nickname)
    where household_id = v_inv.household_id and user_id = p_user;
  else
    insert into public.household_members (household_id, user_id, role, relationship_label, storyteller_nickname)
    values (v_inv.household_id, p_user, v_inv.invitee_role, v_inv.relationship_label, v_nickname);
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

update public.household_members m
set storyteller_nickname = left(btrim(i.invitee_name), 40)
from public.household_invitations i
join auth.users u on u.id = i.accepted_by
left join public.adult_profiles p on p.user_id = i.accepted_by
where i.accepted_by = m.user_id
  and i.household_id = m.household_id
  and i.invitee_role = 'guardian'
  and m.removed_at is null
  and m.storyteller_nickname is null
  and nullif(btrim(i.invitee_name), '') is not null
  and lower(btrim(i.invitee_name)) <> lower(split_part(u.email, '@', 1))
  and lower(btrim(i.invitee_name)) <> lower(coalesce(p.display_name, ''));
