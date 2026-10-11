alter table public.household_entitlements
  add column tier text not null default 'family' check (tier in ('family', 'archive')),
  add column trial_ends_at timestamptz;

comment on column public.household_entitlements.tier is 'family: Readli Family, makes new stories. archive: Readli Family Archive, keeps and plays prepared stories, kids profiles and permissions; no new stories, monthly credits or extra narrator slots.';
comment on column public.household_entitlements.trial_ends_at is 'End of a paid subscription''s free trial. Until then the household gets the trial credits, not the monthly ones.';

create or replace function public.narrator_slot_count(p_household uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (select included_narrator_slots from plan_settings) + e.extra_narrator_slots
                   from household_entitlements e
                   where e.household_id = p_household and e.status = 'active' and e.tier = 'family'
                     and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
                   order by e.starts_at limit 1), 0);
$$;

alter table public.plan_settings
  add column archive_monthly_price_cents integer not null default 699 check (archive_monthly_price_cents > 0),
  alter column purchased_credit_months set default 0,
  alter column welcome_promo_credits set default 0,
  alter column welcome_promo_days set default 0;

update public.plan_settings set purchased_credit_months = 0 where purchased_credit_months = 12;
update public.plan_settings set welcome_promo_credits = 0 where welcome_promo_credits = 300;
update public.plan_settings set welcome_promo_days = 0 where welcome_promo_days = 30;

comment on column public.plan_settings.purchased_credit_months is 'Unused by the app, which never expires purchased credits until an expiry is approved after a prepaid-credit law review.';
comment on column public.plan_settings.welcome_promo_credits is 'Unused by the app: welcome credits are granted in code (PLAN_WELCOME_PROMO_CREDITS), in whole credits.';

drop trigger if exists household_entitlements_welcome on public.household_entitlements;
drop function if exists public.grant_welcome_credits();

alter table public.permission_audit_log drop constraint if exists permission_audit_log_action_check;
alter table public.permission_audit_log add constraint permission_audit_log_action_check check (action in (
  'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
  'narration_authorized', 'narration_denied', 'narration_requested', 'narration_canceled',
  'narrator_activated', 'narrator_released', 'narrator_slot_added', 'child_profile_created',
  'child_profile_removed', 'entitlement_granted', 'credits_purchased', 'voice_withdrawn', 'plan_changed'
));

create or replace function public.stop_voice_narration(p_voice uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
  v_count integer := 0;
begin
  for v_job in
    select j.id from public.narration_jobs j
    join public.narration_libraries l on l.key = j.library_key
    where l.voice_id = p_voice and j.status in ('queued', 'running')
    for update of j
  loop
    update public.narration_jobs set status = 'canceled', finished_at = now() where id = v_job;
    perform public.settle_narration_job(v_job);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.stop_household_narration(p_household uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
  v_count integer := 0;
begin
  for v_job in
    select id from public.narration_jobs
    where household_id = p_household and status in ('queued', 'running')
    for update
  loop
    update public.narration_jobs set status = 'canceled', finished_at = now() where id = v_job;
    perform public.settle_narration_job(v_job);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.stop_voice_narration(uuid) from public, anon, authenticated;
revoke all on function public.stop_household_narration(uuid) from public, anon, authenticated;

create table public.lifecycle_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  run_id uuid,
  actor text not null,
  action text not null check (action in (
    'voice_withdrawn', 'voice_version_upgraded', 'clone_created', 'clone_retired', 'clone_reactivated',
    'voice_unlinked', 'voice_relinked', 'legal_removal', 'plan_changed', 'jobs_stopped',
    'recovery_started', 'recovery_notice', 'recovery_restored', 'recovery_held', 'recovery_deleted',
    'safeguard_stopped'
  )),
  household_id uuid,
  voice_id uuid,
  dry_run boolean not null default false,
  detail jsonb not null default '{}'
);
create index lifecycle_audit_log_action_at on public.lifecycle_audit_log (action, at desc);
create index lifecycle_audit_log_household on public.lifecycle_audit_log (household_id, at desc);
create index lifecycle_audit_log_voice on public.lifecycle_audit_log (voice_id, at desc);

create or replace function public.lifecycle_audit_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'lifecycle_audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger lifecycle_audit_no_change before update or delete on public.lifecycle_audit_log
  for each row execute function public.lifecycle_audit_append_only();

comment on table public.lifecycle_audit_log is 'Append-only record of voice lifecycle, plan changes, recovery windows, legal removals and every destructive or dry-run lifecycle step. household_id and voice_id are plain values so the record outlives what it describes.';

create table public.household_recovery (
  household_id uuid primary key references public.households (id) on delete cascade,
  access_ended_at timestamptz not null,
  deletion_due_at timestamptz not null,
  status text not null default 'recovering' check (status in ('recovering', 'restored', 'held', 'deleted')),
  notices jsonb not null default '{}',
  hold_reason text,
  restored_at timestamptz,
  restored_tier text check (restored_tier in ('family', 'archive')),
  deleted_at timestamptz,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index household_recovery_status on public.household_recovery (status, deletion_due_at);
create trigger household_recovery_updated_at before update on public.household_recovery
  for each row execute function public.set_updated_at();

comment on table public.household_recovery is 'The recovery window after a household''s paid access ends (plan recovery days, 30 by default). Nothing streams; the family can reactivate Readli Family or choose the Archive. notices records which reminder emails were queued.';

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  household_id uuid references public.households (id) on delete set null,
  recipient_user_id uuid references auth.users (id) on delete cascade,
  template text not null,
  subject text not null,
  body text not null,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  provider_ref text,
  last_error text,
  created_at timestamptz not null default now()
);
create index email_outbox_unsent on public.email_outbox (send_after) where sent_at is null;

comment on table public.email_outbox is 'Emails waiting to be sent. No email provider is connected yet, so rows stay unsent until one is chosen.';

alter table public.lifecycle_audit_log enable row level security;
alter table public.household_recovery enable row level security;
alter table public.email_outbox enable row level security;
revoke all on public.lifecycle_audit_log from anon, authenticated;
revoke all on public.household_recovery from anon, authenticated;
revoke all on public.email_outbox from anon, authenticated;
