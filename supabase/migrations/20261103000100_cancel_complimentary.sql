alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in (
    'tester_plan_granted', 'tester_plan_ended', 'complimentary_issued', 'empty_family_removed',
    'complimentary_revoked', 'complimentary_code_revealed', 'complimentary_artwork_downloaded',
    'complimentary_emailed', 'complimentary_cancelled'
  ));

create or replace function public.cancel_complimentary_gift(p_gift uuid)
returns table (household_id uuid, cut_seconds bigint, billing_deferral text, subscription_ref text, family_ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gifts;
  v_months integer;
  v_home uuid;
  v_start timestamptz;
  v_cut interval := interval '0';
  v_ent public.household_entitlements;
  v_ends timestamptz;
  v_sub text;
begin
  select * into v_gift from public.gifts g where g.id = p_gift for update;
  if not found or v_gift.complimentary_for is null then
    raise exception 'membership not found' using errcode = 'no_data_found';
  end if;
  if v_gift.status <> 'active' or v_gift.redeemed_at is null then
    raise exception 'membership not active' using errcode = 'check_violation';
  end if;

  select coalesce(p.months, 12) into v_months from public.gift_plans p where p.id = v_gift.plan_id;
  v_months := coalesce(v_months, 12);

  select m.household_id into v_home from public.household_members m
  where m.user_id = v_gift.recipient_user_id and m.role = 'guardian' and m.removed_at is null
  order by m.joined_at limit 1;

  if v_gift.paid_through is not null then
    v_start := v_gift.paid_through - make_interval(months => v_months);
    v_cut := v_gift.paid_through - greatest(v_start, now());
    if v_cut < interval '0' then
      v_cut := interval '0';
    end if;
  end if;

  if v_gift.billing_deferral is null and v_home is not null and v_cut > interval '0' then
    select * into v_ent from public.household_entitlements e
    where e.household_id = v_home and e.status = 'active' and e.source in ('gift', 'donated')
      and e.ends_at >= v_gift.paid_through and e.starts_at <= greatest(v_start, now())
    order by e.ends_at limit 1;
    if found then
      update public.household_entitlements e
      set ends_at = greatest(now(), e.ends_at - v_cut), updated_at = now()
      where e.id = v_ent.id
      returning e.ends_at into v_ends;
      update public.gifts g
      set paid_through = g.paid_through - v_cut, updated_at = now()
      where g.recipient_user_id = v_gift.recipient_user_id and g.id <> v_gift.id and g.status = 'active'
        and g.billing_deferral is null and g.paid_through > v_gift.paid_through;
    end if;
  end if;

  if v_gift.billing_deferral is not null and v_home is not null then
    select e.provider_subscription_ref into v_sub from public.household_entitlements e
    where e.household_id = v_home and e.source = 'subscription' and e.status = 'active'
    order by e.starts_at desc limit 1;
  end if;

  update public.gifts g
  set status = 'ended', revoked_at = now(), paid_through = least(g.paid_through, now()), updated_at = now()
  where g.id = v_gift.id;

  return query select v_home, extract(epoch from v_cut)::bigint, v_gift.billing_deferral, v_sub, v_ends;
end;
$$;

revoke all on function public.cancel_complimentary_gift(uuid) from public, anon, authenticated;
