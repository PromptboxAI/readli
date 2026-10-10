-- Voice narration libraries, pre-generation and instant narrator switching.
--
-- One library per voice version × book edition × text revision × model/config (× household only
-- when cross-household reuse isn't licensed). Segments are stable sentences; audio lives in the
-- private "narrations" bucket and is served only through short-lived signed URLs after
-- child_can_hear_voice() passes. Households prepare narration with seconds from a credit ledger:
-- only new text is charged, replays and reuse are free. Supersedes public.narration_assets
-- (kept for its existing revocation triggers; no longer written).

alter table public.voice_profiles add column if not exists version integer not null default 1;

alter table public.plan_settings
  add column monthly_narration_minutes integer not null default 30,
  add column narration_minute_price_cents integer not null default 25,
  add column narration_purchases_enabled boolean not null default false,
  add column cross_household_reuse boolean not null default false,
  add column narration_model_id text not null default 'eleven_multilingual_v2',
  add column playback_url_ttl_seconds integer not null default 120 check (playback_url_ttl_seconds between 15 and 900),
  add column max_segment_attempts integer not null default 3 check (max_segment_attempts between 1 and 10);

create table public.narration_libraries (
  key text primary key,
  voice_id uuid not null references public.voice_profiles (id) on delete cascade,
  voice_version integer not null,
  book_slug text not null,
  edition text not null,
  text_revision text not null,
  model_id text not null,
  config_hash text not null,
  -- 'shared', or the household id when the library may not be reused across households.
  scope text not null,
  created_at timestamptz not null default now()
);
-- Never two libraries for the same narration.
create unique index narration_libraries_identity
  on public.narration_libraries (voice_id, voice_version, book_slug, edition, text_revision, model_id, config_hash, scope);

create table public.narration_jobs (
  id uuid primary key default gen_random_uuid(),
  library_key text not null references public.narration_libraries (key) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  scope text not null check (scope in ('book', 'chapter', 'passage')),
  sentence_ids text[] not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index narration_jobs_active on public.narration_jobs (status) where status in ('queued', 'running');

create table public.narration_segments (
  library_key text not null references public.narration_libraries (key) on delete cascade,
  sentence_id text not null,
  ordinal integer not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  job_id uuid references public.narration_jobs (id) on delete set null,
  storage_key text,
  characters integer not null check (characters > 0),
  duration_ms integer,
  provider_credits integer,
  attempts integer not null default 0,
  error text,
  ready_at timestamptz,
  primary key (library_key, sentence_id),
  -- Ready means stored.
  check (status <> 'ready' or storage_key is not null)
);

create table public.narration_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  kind text not null check (kind in ('allowance', 'purchase', 'reserve', 'commit', 'refund')),
  seconds integer not null check (seconds >= 0),
  job_id uuid references public.narration_jobs (id) on delete set null,
  sentence_id text,
  at timestamptz not null default now()
);
-- A job reserves, commits and refunds each sentence at most once.
create unique index narration_ledger_once
  on public.narration_credit_ledger (job_id, sentence_id, kind) where job_id is not null and kind in ('reserve', 'commit');
create index narration_ledger_household on public.narration_credit_ledger (household_id, period);

create table public.narration_provider_usage (
  id uuid primary key default gen_random_uuid(),
  library_key text not null,
  sentence_id text not null,
  model_id text not null,
  characters integer not null,
  provider_credits integer not null,
  duration_ms integer not null,
  bytes integer not null,
  at timestamptz not null default now()
);

create table public.narration_plays (
  id bigint generated always as identity primary key,
  library_key text not null,
  sentence_id text not null,
  household_id uuid not null references public.households (id) on delete cascade,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  at timestamptz not null default now()
);

create table public.family_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  text text not null,
  href text not null,
  at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.permission_audit_log drop constraint if exists permission_audit_log_action_check;
alter table public.permission_audit_log add constraint permission_audit_log_action_check check (action in (
  'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
  'narration_authorized', 'narration_denied', 'narration_requested', 'narration_canceled',
  'narrator_activated', 'narrator_released', 'narrator_slot_added', 'child_profile_created',
  'child_profile_removed', 'entitlement_granted'
));

-- ---------------------------------------------------------------------------
-- Claiming segments: the first confirmed request claims and pays; anyone asking for audio that is
-- queued or stored pays nothing. Serialized per library so simultaneous requests can't both claim.
-- Returns the job id, or null when nothing was missing.
-- ---------------------------------------------------------------------------
create or replace function public.claim_narration_segments(
  p_library_key text,
  p_household uuid,
  p_user uuid,
  p_scope text,
  p_sentences jsonb -- [{ "id": text, "ordinal": int, "characters": int, "seconds": int }] in generation order
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
  v_missing jsonb;
  v_need integer;
  v_available integer;
  v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_settings public.plan_settings;
begin
  perform pg_advisory_xact_lock(hashtext(p_library_key));
  select * into v_settings from public.plan_settings limit 1;

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

  select coalesce(sum((s->>'seconds')::int), 0) into v_need from jsonb_array_elements(v_missing) s;
  perform pg_advisory_xact_lock(hashtext('narration-credits:' || p_household::text));
  select public.narration_seconds_available(p_household) into v_available;
  if v_need > v_available then
    raise exception 'not_enough_credits' using errcode = 'P0402';
  end if;

  insert into public.narration_jobs (library_key, household_id, requested_by, scope, sentence_ids)
  values (p_library_key, p_household, p_user, p_scope, array(select s->>'id' from jsonb_array_elements(v_missing) s))
  returning id into v_job;

  insert into public.narration_segments (library_key, sentence_id, ordinal, characters, status, job_id, attempts, error)
  select p_library_key, s->>'id', (s->>'ordinal')::int, (s->>'characters')::int, 'pending', v_job, 0, null
  from jsonb_array_elements(v_missing) s
  on conflict (library_key, sentence_id) do update set status = 'pending', job_id = v_job, attempts = 0, error = null;

  insert into public.narration_credit_ledger (household_id, period, kind, seconds, job_id, sentence_id)
  select p_household, v_period, 'reserve', (s->>'seconds')::int, v_job, s->>'id' from jsonb_array_elements(v_missing) s;

  insert into public.permission_audit_log (actor, action, household_id, detail)
  values (p_user::text, 'narration_requested', p_household, p_library_key || ':' || jsonb_array_length(v_missing));
  return v_job;
end;
$$;

-- Seconds this household can still reserve: this month's allowance plus purchased seconds not yet
-- spent in any month that went past its allowance.
create or replace function public.narration_seconds_available(p_household uuid) returns integer
language sql stable security definer set search_path = public as $$
  with s as (select monthly_narration_minutes * 60 as allowance from public.plan_settings limit 1),
  a as (select case when (public.active_entitlement(p_household)).id is not null then (select allowance from s) else 0 end as allowance),
  net as (
    select period, sum(case kind when 'reserve' then seconds when 'refund' then -seconds else 0 end) as used
    from public.narration_credit_ledger where household_id = p_household group by period
  ),
  bought as (select coalesce(sum(seconds), 0) as total from public.narration_credit_ledger where household_id = p_household and kind = 'purchase')
  select (
    greatest(0, (select allowance from a) - coalesce((select used from net where period = to_char(now() at time zone 'utc', 'YYYY-MM')), 0))
    + greatest(0, (select total from bought) - coalesce((select sum(greatest(0, used - (select allowance from a))) from net), 0))
  )::int;
$$;

-- Releases a finished, failed or canceled job's unfinished segments and refunds them, once.
create or replace function public.settle_narration_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.narration_segments
    set job_id = null, status = case when status = 'generating' then 'failed' else status end
    where job_id = p_job and status <> 'ready';
  insert into public.narration_credit_ledger (household_id, period, kind, seconds, job_id, sentence_id)
  select r.household_id, r.period, 'refund', r.seconds, r.job_id, r.sentence_id
  from public.narration_credit_ledger r
  where r.job_id = p_job and r.kind = 'reserve'
    and not exists (select 1 from public.narration_credit_ledger c where c.job_id = p_job and c.sentence_id = r.sentence_id and c.kind = 'commit')
    and not exists (select 1 from public.narration_credit_ledger f where f.job_id = p_job and f.sentence_id = r.sentence_id and f.kind = 'refund');
end;
$$;

-- A child may play a segment only if every gate passes and the segment is stored.
create or replace function public.child_can_play_segment(p_child uuid, p_library_key text, p_sentence text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.narration_libraries l
    join public.narration_segments g on g.library_key = l.key and g.sentence_id = p_sentence
    join public.child_profiles c on c.id = p_child
    where l.key = p_library_key
      and g.status = 'ready' and g.storage_key is not null
      and (l.scope = 'shared' or l.scope = c.household_id::text)
      and public.child_can_hear_voice(p_child, l.voice_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: reads for household members; every write goes through route handlers and
-- the worker (service role). Audio objects are never readable directly.
-- ---------------------------------------------------------------------------
alter table public.narration_libraries enable row level security;
alter table public.narration_segments enable row level security;
alter table public.narration_jobs enable row level security;
alter table public.narration_credit_ledger enable row level security;
alter table public.narration_provider_usage enable row level security;
alter table public.narration_plays enable row level security;
alter table public.family_notifications enable row level security;

create policy jobs_member_read on public.narration_jobs for select
  using (public.is_active_member(auth.uid(), household_id));
create policy ledger_member_read on public.narration_credit_ledger for select
  using (public.is_active_member(auth.uid(), household_id));
create policy notifications_member_read on public.family_notifications for select
  using (public.is_active_member(auth.uid(), household_id));
-- Libraries, segments, usage and plays: service role only (admin dashboard and signed playback).

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('narrations', 'narrations', false)
    on conflict (id) do update set public = false;
  end if;
end;
$$;
