create or replace function public.redeem_gift(p_code_hash text, p_user uuid, p_family_name text)
returns table (household_id uuid, paid_through timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gifts;
  v_plan public.gift_plans;
  v_home uuid;
  v_months integer;
  v_ent public.household_entitlements;
  v_start timestamptz := now();
  v_end timestamptz;
begin
  select * into v_gift from public.gifts g where g.code_hash = p_code_hash for update;
  if not found then
    raise exception 'gift not found' using errcode = 'no_data_found';
  end if;
  if v_gift.status = 'cancelled' then
    raise exception 'gift cancelled' using errcode = 'check_violation';
  end if;
  if v_gift.status in ('active', 'ended') or v_gift.redeemed_at is not null then
    raise exception 'gift already redeemed' using errcode = 'check_violation';
  end if;
  if v_gift.status <> 'sent' then
    raise exception 'gift not ready' using errcode = 'check_violation';
  end if;
  if v_gift.sent_at is not null and v_gift.sent_at < now() - interval '365 days' then
    raise exception 'gift unclaimed' using errcode = 'check_violation';
  end if;
  if v_gift.giver_id = p_user then
    raise exception 'own gift' using errcode = 'check_violation';
  end if;

  select * into v_plan from public.gift_plans where id = v_gift.plan_id;
  v_months := coalesce(v_plan.months, 1);

  select m.household_id into v_home from public.household_members m
  where m.user_id = p_user and m.role = 'guardian' and m.removed_at is null
  order by m.joined_at limit 1;
  if v_home is null then
    insert into public.households (name, created_by)
    values (left(coalesce(nullif(trim(p_family_name), ''), 'My family'), 120), p_user)
    returning id into v_home;
    insert into public.household_members (household_id, user_id, role) values (v_home, p_user, 'guardian');
  end if;

  select * into v_ent from public.household_entitlements e
  where e.household_id = v_home and e.status = 'active' and e.starts_at <= now() and e.ends_at > now()
  order by e.ends_at desc limit 1;
  if found then
    v_start := v_ent.ends_at;
    v_end := v_ent.ends_at + make_interval(months => v_months);
    update public.household_entitlements set ends_at = v_end, updated_at = now() where id = v_ent.id;
  else
    v_end := v_start + make_interval(months => v_months);
    insert into public.household_entitlements (household_id, source, status, starts_at, ends_at)
    values (v_home, 'gift', 'active', v_start, v_end);
  end if;

  update public.gifts
  set status = 'active', redeemed_at = now(), recipient_user_id = p_user, paid_through = v_end, recipient_email = null, updated_at = now()
  where id = v_gift.id;

  return query select v_home, v_end;
end;
$$;

revoke all on function public.redeem_gift(text, uuid, text) from public, anon, authenticated;
