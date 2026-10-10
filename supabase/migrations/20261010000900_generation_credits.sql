-- Book discovery, generation credits and short-story launch.
--
-- Narration is paid for in Readli credits (1 credit = plan_settings.seconds_per_credit seconds of
-- new narration). Credits come from lots: each month's subscription allowance (derived, so the admin
-- setting applies at once, with optional rollover), promotional grants (welcome credits, admin
-- grants) and purchased packs. Spending takes the soonest-expiring lot first; ties go promotional,
-- subscription, purchased. Every reserve, commit and refund names the lot, so refunds go back where
-- they came from. Cached narration never touches the ledger.

-- Free trials (rewards program) are Family entitlements with their own one-off narration allowance.
alter table public.household_entitlements drop constraint if exists household_entitlements_source_check;
alter table public.household_entitlements add constraint household_entitlements_source_check
  check (source in ('subscription', 'gift', 'donated', 'trial'));

alter table public.plan_settings
  add column trial_narration_minutes integer not null default 10 check (trial_narration_minutes >= 0),
  add column seconds_per_credit integer not null default 1 check (seconds_per_credit >= 1),
  add column quote_safety_margin numeric(4, 3) not null default 0.1 check (quote_safety_margin between 0 and 1),
  -- Provisional packs; final pricing waits for commercial testing.
  add column credit_packs jsonb not null default '[{"id":"pack-small","credits":600,"priceCents":299},{"id":"pack-medium","credits":1800,"priceCents":799},{"id":"pack-large","credits":3600,"priceCents":1499}]',
  add column purchased_credit_months integer not null default 12 check (purchased_credit_months >= 0),
  add column subscription_rollover_months integer not null default 0 check (subscription_rollover_months between 0 and 12),
  add column welcome_promo_credits integer not null default 300 check (welcome_promo_credits >= 0),
  add column welcome_promo_days integer not null default 30 check (welcome_promo_days >= 0),
  add column quick_story_max_minutes integer not null default 3,
  add column recommended_short_stories text[] not null default array['the-tale-of-peter-rabbit', 'the-lion-and-the-mouse', 'the-three-little-pigs'],
  add column bedtime_favorites text[] not null default array['the-princess-and-the-pea', 'winnie-the-pooh', 'the-tale-of-peter-rabbit'],
  add column chapter_generation_enabled boolean not null default true;
alter table public.plan_settings drop column if exists narration_minute_price_cents;

create table public.narration_credit_lots (
  id text primary key default gen_random_uuid()::text,
  household_id uuid not null references public.households (id) on delete cascade,
  source text not null check (source in ('promotional', 'purchased')),
  credits integer not null check (credits > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  note text not null,
  payment_ref text,
  granted_by uuid references auth.users (id)
);
create index narration_credit_lots_household on public.narration_credit_lots (household_id);

-- Ledger rows are now in credits and name their lot ('subscription:YYYY-MM' or a lot id).
alter table public.narration_credit_ledger rename column seconds to credits;
alter table public.narration_credit_ledger add column lot_id text not null default '';
alter table public.narration_credit_ledger alter column lot_id drop default;
alter table public.narration_credit_ledger alter column period drop not null;
alter table public.narration_credit_ledger drop constraint if exists narration_credit_ledger_kind_check;
alter table public.narration_credit_ledger add constraint narration_credit_ledger_kind_check check (kind in ('reserve', 'commit', 'refund'));
drop index if exists public.narration_ledger_once;
create unique index narration_ledger_once
  on public.narration_credit_ledger (job_id, sentence_id, kind, lot_id) where job_id is not null;

alter table public.narration_jobs add column reservations jsonb not null default '{}';

alter table public.permission_audit_log drop constraint if exists permission_audit_log_action_check;
alter table public.permission_audit_log add constraint permission_audit_log_action_check check (action in (
  'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
  'narration_authorized', 'narration_denied', 'narration_requested', 'narration_canceled',
  'narrator_activated', 'narrator_released', 'narrator_slot_added', 'child_profile_created',
  'child_profile_removed', 'entitlement_granted', 'credits_purchased'
));

drop function if exists public.narration_seconds_available(uuid);

-- Spendable lots for a household at p_at, in spending order, with what's left in each.
create or replace function public.narration_lots(p_household uuid, p_at timestamptz default now())
returns table (lot_id text, source text, credits integer, expires_at timestamptz, credits_left integer)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.plan_settings limit 1),
  ent as (select * from public.active_entitlement(p_household)),
  trial as (
    select 'trial:' || e.id::text as lot_id, 'subscription'::text as source,
      ((select trial_narration_minutes * 60 / seconds_per_credit from s))::int as credits, e.ends_at as expires_at
    from ent e where e.id is not null and e.source = 'trial'
  ),
  sub as (
    select 'subscription:' || to_char(m, 'YYYY-MM') as lot_id, 'subscription'::text as source,
      ((select monthly_narration_minutes * 60 / seconds_per_credit from s))::int as credits,
      (m + make_interval(months => 1 + (select subscription_rollover_months from s))) as expires_at
    from generate_series(
      date_trunc('month', p_at at time zone 'utc') - make_interval(months => (select subscription_rollover_months from s)),
      date_trunc('month', p_at at time zone 'utc'), interval '1 month') as m
    where exists (select 1 from ent where ent.id is not null and ent.source <> 'trial')
  ),
  granted as (
    select l.id, l.source, l.credits, l.expires_at from public.narration_credit_lots l
    where l.household_id = p_household and l.granted_at <= p_at and (l.expires_at is null or l.expires_at > p_at)
  ),
  lots as (select * from trial union all select * from sub union all select * from granted)
  select l.lot_id, l.source, l.credits, l.expires_at,
    greatest(0, l.credits - coalesce((
      select sum(case e.kind when 'reserve' then e.credits when 'refund' then -e.credits else 0 end)
      from public.narration_credit_ledger e where e.household_id = p_household and e.lot_id = l.lot_id), 0))::int
  from lots l
  order by coalesce(l.expires_at, 'infinity'::timestamptz), case l.source when 'promotional' then 0 when 'subscription' then 1 else 2 end;
$$;

create or replace function public.narration_credits_available(p_household uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(credits_left), 0)::int from public.narration_lots(p_household);
$$;

-- Claims missing segments and reserves their credits, lot by lot. Serialized per library (no
-- duplicate jobs) and per household (no double spending). p_sentences carries per-sentence credits
-- computed from the actual text, the model and the quote safety margin.
drop function if exists public.claim_narration_segments(text, uuid, uuid, text, jsonb);
create or replace function public.claim_narration_segments(
  p_library_key text,
  p_household uuid,
  p_user uuid,
  p_scope text,
  p_sentences jsonb -- [{ "id": text, "ordinal": int, "characters": int, "credits": int }] in generation order
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
  v_missing jsonb;
  v_need integer;
  v_sentence jsonb;
  v_lot record;
  v_left integer;
  v_take integer;
  v_draws jsonb;
  v_reservations jsonb := '{}';
  v_used jsonb := '{}';
begin
  perform pg_advisory_xact_lock(hashtext(p_library_key));
  select coalesce(jsonb_agg(s order by ord), '[]'::jsonb) into v_missing
  from jsonb_array_elements(p_sentences) with ordinality as x(s, ord)
  where not exists (
    select 1 from public.narration_segments g
    left join public.narration_jobs j on j.id = g.job_id
    where g.library_key = p_library_key and g.sentence_id = x.s->>'id'
      and (g.status = 'ready' or j.status in ('queued', 'running'))
  );
  if jsonb_array_length(v_missing) = 0 then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('narration-credits:' || p_household::text));
  select coalesce(sum((s->>'credits')::int), 0) into v_need from jsonb_array_elements(v_missing) s;
  if v_need > public.narration_credits_available(p_household) then
    raise exception 'not_enough_credits' using errcode = 'P0402';
  end if;

  insert into public.narration_jobs (library_key, household_id, requested_by, scope, sentence_ids)
  values (p_library_key, p_household, p_user, p_scope, array(select s->>'id' from jsonb_array_elements(v_missing) s))
  returning id into v_job;

  for v_sentence in select s from jsonb_array_elements(v_missing) s loop
    v_left := (v_sentence->>'credits')::int;
    v_draws := '[]';
    for v_lot in select * from public.narration_lots(p_household) loop
      exit when v_left = 0;
      v_take := least(v_left, v_lot.credits_left - coalesce((v_used->>v_lot.lot_id)::int, 0));
      continue when v_take <= 0;
      v_used := v_used || jsonb_build_object(v_lot.lot_id, coalesce((v_used->>v_lot.lot_id)::int, 0) + v_take);
      v_draws := v_draws || jsonb_build_array(jsonb_build_object('lotId', v_lot.lot_id, 'credits', v_take));
      v_left := v_left - v_take;
    end loop;
    v_reservations := v_reservations || jsonb_build_object(v_sentence->>'id', v_draws);
  end loop;

  -- Ledger rows are written after allocation, so narration_lots() above saw a stable balance.
  insert into public.narration_credit_ledger (household_id, lot_id, kind, credits, job_id, sentence_id)
  select p_household, d->>'lotId', 'reserve', (d->>'credits')::int, v_job, r.key
  from jsonb_each(v_reservations) r, jsonb_array_elements(r.value) d;
  update public.narration_jobs set reservations = v_reservations where id = v_job;

  insert into public.narration_segments (library_key, sentence_id, ordinal, characters, status, job_id, attempts, error)
  select p_library_key, s->>'id', (s->>'ordinal')::int, (s->>'characters')::int, 'pending', v_job, 0, null
  from jsonb_array_elements(v_missing) s
  on conflict (library_key, sentence_id) do update set status = 'pending', job_id = v_job, attempts = 0, error = null;

  insert into public.permission_audit_log (actor, action, household_id, detail)
  values (p_user::text, 'narration_requested', p_household, p_library_key || ':' || jsonb_array_length(v_missing));
  return v_job;
end;
$$;

-- Reconciles one finished segment: commits what was used (capped at what was reserved), lot by lot
-- in draw order, and refunds the rest to the same lots. Idempotent.
create or replace function public.commit_narration_segment(p_job uuid, p_sentence text, p_used integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job public.narration_jobs;
  v_draw jsonb;
  v_left integer := p_used;
  v_take integer;
begin
  select * into v_job from public.narration_jobs where id = p_job for update;
  if exists (select 1 from public.narration_credit_ledger where job_id = p_job and sentence_id = p_sentence and kind = 'commit') then
    return;
  end if;
  for v_draw in select d from jsonb_array_elements(coalesce(v_job.reservations->p_sentence, '[]')) d loop
    v_take := least((v_draw->>'credits')::int, v_left);
    v_left := v_left - v_take;
    insert into public.narration_credit_ledger (household_id, lot_id, kind, credits, job_id, sentence_id)
    values (v_job.household_id, v_draw->>'lotId', 'commit', v_take, p_job, p_sentence);
    if (v_draw->>'credits')::int > v_take then
      insert into public.narration_credit_ledger (household_id, lot_id, kind, credits, job_id, sentence_id)
      values (v_job.household_id, v_draw->>'lotId', 'refund', (v_draw->>'credits')::int - v_take, p_job, p_sentence);
    end if;
  end loop;
end;
$$;

-- Releases a finished, failed or canceled job's unfinished segments and refunds them, once.
create or replace function public.settle_narration_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.narration_segments
    set job_id = null, status = case when status = 'generating' then 'failed' else status end
    where job_id = p_job and status <> 'ready';
  insert into public.narration_credit_ledger (household_id, lot_id, kind, credits, job_id, sentence_id)
  select r.household_id, r.lot_id, 'refund', r.credits, r.job_id, r.sentence_id
  from public.narration_credit_ledger r
  where r.job_id = p_job and r.kind = 'reserve'
    and not exists (select 1 from public.narration_credit_ledger c where c.job_id = p_job and c.sentence_id = r.sentence_id and c.kind in ('commit', 'refund'));
end;
$$;

-- Welcome credits the first time a household gets Readli Family.
create or replace function public.grant_welcome_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_settings public.plan_settings;
begin
  select * into v_settings from public.plan_settings limit 1;
  if v_settings.welcome_promo_credits > 0
     and not exists (select 1 from public.household_entitlements e where e.household_id = new.household_id and e.id <> new.id) then
    insert into public.narration_credit_lots (household_id, source, credits, expires_at, note)
    values (new.household_id, 'promotional', v_settings.welcome_promo_credits,
      case when v_settings.welcome_promo_days > 0 then now() + make_interval(days => v_settings.welcome_promo_days) end,
      'Welcome credits for your first stories');
  end if;
  return new;
end;
$$;
create trigger household_entitlements_welcome after insert on public.household_entitlements
  for each row execute function public.grant_welcome_credits();

alter table public.narration_credit_lots enable row level security;
create policy credit_lots_member_read on public.narration_credit_lots for select
  using (public.is_active_member(auth.uid(), household_id));
