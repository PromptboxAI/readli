create or replace function public.attribute_referral(p_code text, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_from uuid;
  v_to uuid;
  v_reason text;
begin
  select user_id into v_referrer from public.referral_codes where code = lower(p_code);
  if v_referrer is null then
    return 'unknown_code';
  end if;
  select household_id into v_from from public.household_members
  where user_id = v_referrer and role = 'guardian' and removed_at is null order by joined_at limit 1;
  select household_id into v_to from public.household_members
  where user_id = p_user and role = 'guardian' and removed_at is null order by joined_at limit 1;
  if v_from is null or v_to is null then
    return 'no_family';
  end if;
  if v_from = v_to or v_referrer = p_user then
    return 'self_referral';
  end if;
  if exists (select 1 from public.referrals where referred_household_id = v_to) then
    return 'already_referred';
  end if;
  if exists (
    select 1 from public.household_members a join public.household_members b on a.user_id = b.user_id
    where a.household_id = v_from and b.household_id = v_to
  ) then
    v_reason := 'self_referral';
  elsif exists (select 1 from public.household_entitlements where household_id = v_to) then
    v_reason := 'existing_customer';
  elsif exists (select 1 from public.referrals where referrer_household_id = v_to and referred_household_id = v_from) then
    v_reason := 'circular';
  end if;
  insert into public.referrals (referrer_household_id, referred_household_id, referrer_user_id, rejected_reason)
  values (v_from, v_to, v_referrer, v_reason)
  on conflict (referred_household_id) do nothing;
  if not found then
    return 'already_referred';
  end if;
  return coalesce(v_reason, 'attributed');
end;
$$;

create or replace function public.record_referral_paid_cycle(p_household uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_needed smallint;
begin
  update public.referrals set paid_cycles = paid_cycles + 1
  where referred_household_id = p_household and rejected_reason is null
  returning * into v_ref;
  if not found then
    return false;
  end if;
  select referral_paid_cycles into v_needed from public.reward_settings;
  if v_ref.paid_cycles <> v_needed then
    return false;
  end if;
  update public.referrals set qualified_at = coalesce(qualified_at, now()) where id = v_ref.id;
  begin
    insert into public.reward_grants (household_id, referral_id) values (v_ref.referrer_household_id, v_ref.id);
  exception when check_violation or unique_violation then
    return false;
  end;
  return true;
end;
$$;

create or replace function public.use_reward_month(p_household uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.reward_grants
  where household_id = p_household and applied_at is null
  order by granted_at limit 1 for update skip locked;
  if v_id is null then
    return false;
  end if;
  update public.reward_grants set applied_at = now() where id = v_id;
  return true;
end;
$$;

revoke all on function public.attribute_referral(text, uuid) from public, anon, authenticated;
revoke all on function public.record_referral_paid_cycle(uuid) from public, anon, authenticated;
revoke all on function public.use_reward_month(uuid) from public, anon, authenticated;
