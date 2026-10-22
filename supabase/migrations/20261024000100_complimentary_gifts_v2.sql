create table if not exists public.complimentary_batches (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique check (char_length(request_key) between 8 and 80),
  label text check (char_length(label) <= 120),
  prefix text not null check (prefix ~ '^[A-Z0-9]{2,5}$'),
  sponsor_name text not null check (char_length(sponsor_name) between 1 and 120),
  sponsor_is_readli boolean not null default true,
  event_name text check (char_length(event_name) <= 120),
  occasion text not null check (occasion in ('raffle', 'auction', 'gift_basket', 'school', 'charity', 'fundraiser', 'promotion')),
  months integer not null check (months in (1, 3, 12)),
  message text check (char_length(message) <= 300),
  claim_by timestamptz not null,
  issued_by uuid references auth.users (id) on delete set null,
  issued_by_email text not null,
  created_at timestamptz not null default now()
);
alter table public.complimentary_batches enable row level security;
create index if not exists complimentary_batches_recent on public.complimentary_batches (created_at desc);

alter table public.gifts alter column recipient_name drop not null;
alter table public.gifts add column if not exists batch_id uuid references public.complimentary_batches (id) on delete restrict;
alter table public.gifts add column if not exists certificate_no integer check (certificate_no > 0);
alter table public.gifts add column if not exists code_last4 text check (code_last4 ~ '^[0-9A-Z]{4}$');
alter table public.gifts add column if not exists code_encrypted bytea;
alter table public.gifts add column if not exists event_name text check (char_length(event_name) <= 120);
alter table public.gifts add column if not exists claim_by timestamptz;
alter table public.gifts add column if not exists revoked_at timestamptz;
alter table public.gifts add column if not exists replaced_by uuid references public.gifts (id) on delete set null;
alter table public.gifts add column if not exists billing_deferral text check (billing_deferral in ('pending', 'applied'));
create unique index if not exists gifts_batch_certificate on public.gifts (batch_id, certificate_no) where batch_id is not null;

alter table public.gifts drop constraint if exists gifts_complimentary_for_check;
alter table public.gifts add constraint gifts_complimentary_for_check
  check (complimentary_for in ('raffle', 'auction', 'gift_basket', 'school', 'charity', 'fundraiser', 'promotion'));
alter table public.gifts drop constraint if exists gifts_complimentary_is_annual;
alter table public.gifts drop constraint if exists gifts_complimentary_plan;
alter table public.gifts add constraint gifts_complimentary_plan
  check (complimentary_for is null or (plan_id in ('prepaid_1m', 'prepaid_3m', 'prepaid_12m') and payment_ref is null));

update public.gifts set recipient_name = null
where complimentary_for is not null and recipient_name = 'Your family';

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in (
    'tester_plan_granted', 'tester_plan_ended', 'complimentary_issued', 'empty_family_removed',
    'complimentary_revoked', 'complimentary_code_revealed', 'complimentary_artwork_downloaded'
  ));
create index if not exists admin_actions_batch on public.admin_actions ((detail ->> 'batch_id')) where detail ? 'batch_id';

create or replace function public.issue_complimentary_batch(p_batch jsonb, p_gifts jsonb)
returns table (batch_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.complimentary_batches (request_key, label, prefix, sponsor_name, sponsor_is_readli, event_name, occasion, months, message, claim_by, issued_by, issued_by_email)
  values (
    p_batch ->> 'request_key', nullif(p_batch ->> 'label', ''), p_batch ->> 'prefix', p_batch ->> 'sponsor_name',
    coalesce((p_batch ->> 'sponsor_is_readli')::boolean, true), nullif(p_batch ->> 'event_name', ''), p_batch ->> 'occasion',
    (p_batch ->> 'months')::integer, nullif(p_batch ->> 'message', ''), (p_batch ->> 'claim_by')::timestamptz,
    (p_batch ->> 'issued_by')::uuid, p_batch ->> 'issued_by_email'
  )
  on conflict (request_key) do nothing
  returning id into v_id;

  if v_id is null then
    return query select b.id, false from public.complimentary_batches b where b.request_key = p_batch ->> 'request_key';
    return;
  end if;

  insert into public.gifts (
    giver_id, plan_id, status, sent_at, code_hash, code_last4, code_encrypted, recipient_name, recipient_email,
    giver_display_name, event_name, message, complimentary_for, claim_by, batch_id, certificate_no
  )
  select
    (p_batch ->> 'issued_by')::uuid, g.plan_id, 'sent', now(), g.code_hash, g.code_last4, decode(g.code_encrypted, 'hex'), g.recipient_name, g.recipient_email,
    p_batch ->> 'sponsor_name', nullif(p_batch ->> 'event_name', ''), nullif(p_batch ->> 'message', ''), p_batch ->> 'occasion',
    (p_batch ->> 'claim_by')::timestamptz, v_id, g.certificate_no
  from jsonb_to_recordset(p_gifts) as g(plan_id text, code_hash text, code_last4 text, code_encrypted text, recipient_name text, recipient_email text, certificate_no integer);

  return query select v_id, true;
end;
$$;

revoke all on function public.issue_complimentary_batch(jsonb, jsonb) from public, anon, authenticated;

drop function if exists public.redeem_gift(text, uuid, text);
create or replace function public.redeem_gift(p_code_hash text, p_user uuid, p_family_name text, p_defer_billing boolean default false)
returns table (household_id uuid, paid_through timestamptz, gift_id uuid, months integer, subscription_ref text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gifts;
  v_plan public.gift_plans;
  v_home uuid;
  v_months integer;
  v_sub public.household_entitlements;
  v_ent public.household_entitlements;
  v_latest timestamptz;
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
  if (v_gift.claim_by is not null and v_gift.claim_by < now())
    or (v_gift.claim_by is null and v_gift.sent_at is not null and v_gift.sent_at < now() - interval '365 days') then
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

  select * into v_sub from public.household_entitlements e
  where e.household_id = v_home and e.source = 'subscription' and e.status = 'active' and e.starts_at <= now() and e.ends_at is null
  order by e.starts_at desc limit 1;
  if found then
    if not p_defer_billing then
      raise exception 'subscriber must confirm' using errcode = 'check_violation';
    end if;
    update public.gifts
    set status = 'active', redeemed_at = now(), recipient_user_id = p_user, billing_deferral = 'pending', updated_at = now()
    where id = v_gift.id;
    return query select v_home, null::timestamptz, v_gift.id, v_months, v_sub.provider_subscription_ref;
    return;
  end if;

  update public.household_entitlements e set ends_at = now(), updated_at = now()
  where e.household_id = v_home and e.source = 'trial' and e.status = 'active' and (e.ends_at is null or e.ends_at > now());

  select max(e.ends_at) into v_latest from public.household_entitlements e
  where e.household_id = v_home and e.status = 'active' and e.source <> 'trial' and e.ends_at > now();
  if v_latest is not null then
    v_start := v_latest;
  end if;
  v_end := v_start + make_interval(months => v_months);

  select * into v_ent from public.household_entitlements e
  where e.household_id = v_home and e.status = 'active' and e.source in ('gift', 'donated') and e.ends_at = v_latest
  order by e.created_at desc limit 1;
  if found then
    update public.household_entitlements set ends_at = v_end, updated_at = now() where id = v_ent.id;
  else
    insert into public.household_entitlements (household_id, source, status, starts_at, ends_at)
    values (v_home, case when v_gift.complimentary_for is null then 'gift' else 'donated' end, 'active', v_start, v_end);
  end if;

  update public.gifts
  set status = 'active', redeemed_at = now(), recipient_user_id = p_user, paid_through = v_end, recipient_email = null, updated_at = now()
  where id = v_gift.id;

  return query select v_home, v_end, v_gift.id, v_months, null::text;
end;
$$;

revoke all on function public.redeem_gift(text, uuid, text, boolean) from public, anon, authenticated;
