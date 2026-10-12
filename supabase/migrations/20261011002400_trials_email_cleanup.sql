alter table public.household_entitlements
  add column billing_event_at timestamptz,
  add column trial_credits integer check (trial_credits is null or trial_credits >= 0),
  add column billing_interval text check (billing_interval in ('month', 'year'));
comment on column public.household_entitlements.billing_event_at is 'Creation time of the last Stripe event applied to this plan. Older events arriving late are skipped.';
comment on column public.household_entitlements.billing_interval is 'How often the Stripe subscription bills (monthly or yearly), from its plan item.';
comment on column public.household_entitlements.trial_credits is 'Trial credits for this plan when they differ from plan_settings: 0 when withheld because the card already started a trial for another household.';

alter table public.trial_signals drop constraint if exists trial_signals_kind_check;
alter table public.trial_signals add constraint trial_signals_kind_check check (kind in ('email', 'phone', 'payment_method', 'account'));
comment on table public.trial_signals is 'Hashed signals of every Readli Family trial started: the account, the normalized verified email and the card fingerprint. One trial per household, account and email; a reused card starts Readli Family without trial credits.';

alter table public.voice_profiles alter column owner_id drop not null;
alter table public.voice_profiles drop constraint if exists voice_profiles_owner_id_fkey;
alter table public.voice_profiles add constraint voice_profiles_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;
alter table public.voice_profiles add column owner_deleted_at timestamptz;
comment on column public.voice_profiles.owner_deleted_at is 'The owner deleted their account. The voice is withdrawn, its clone and recordings are gone, and stories already delivered keep playing for the households it was shared with.';

alter table public.voice_training_sessions add column recording_deleted_at timestamptz;
comment on column public.voice_training_sessions.recording_deleted_at is 'The original audio was deleted from Readli storage after a deletion request. The recording details stay as the record of what existed.';

alter table public.households add column cleaned_at timestamptz;
comment on column public.households.cleaned_at is 'Household-specific stories, kids profiles, listening progress and preferences were removed (Day-30 cleanup or account deletion). Plans, credits, payments and audit records stay.';

create table public.voice_recording_deletions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  voice_id uuid references public.voice_profiles (id) on delete set null,
  reason text not null check (reason in ('owner_request', 'account_deletion', 'household_cleanup', 'legal')),
  requested_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'blocked')),
  completed_at timestamptz,
  files_removed integer not null default 0,
  attempts integer not null default 0,
  last_error text,
  detail jsonb not null default '{}'
);
create index voice_recording_deletions_due on public.voice_recording_deletions (status, due_at);
comment on table public.voice_recording_deletions is 'Requests to delete original voice recordings from Readli storage, carried out by the daily lifecycle run, normally within 30 days. Blocked requests go to the admin exception queue.';

create table public.lifecycle_exceptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  household_id uuid references public.households (id) on delete set null,
  voice_id uuid,
  reason text not null,
  detail jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution text
);
create index lifecycle_exceptions_open on public.lifecycle_exceptions (status, created_at desc);
comment on table public.lifecycle_exceptions is 'Admin exception queue: held deletions, unreconciled purchased credits, reused trial cards and failed recording deletions.';

create table public.lifecycle_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'abandoned')),
  deletion_enabled boolean not null,
  clone_retirement_enabled boolean not null,
  counts jsonb not null default '{}',
  errors jsonb not null default '[]'
);
create unique index lifecycle_runs_one_running on public.lifecycle_runs (status) where status = 'running';
comment on table public.lifecycle_runs is 'Each daily lifecycle run: whether destructive steps were enabled, what it did and any errors. Only one run at a time.';

alter table public.email_outbox
  alter column subject drop not null,
  alter column body drop not null,
  add column to_email text,
  add column template_data jsonb not null default '{}',
  add column category text not null default 'transactional' check (category in ('transactional')),
  add column status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'canceled')),
  add column attempts integer not null default 0,
  add column next_attempt_at timestamptz not null default now(),
  add column last_event text,
  add column last_event_at timestamptz;
create index email_outbox_due on public.email_outbox (status, next_attempt_at) where status in ('queued', 'failed');
create index email_outbox_provider_ref on public.email_outbox (provider_ref);
comment on table public.email_outbox is 'Transactional emails, sent through Resend by the email worker with an idempotency key per row. Never used for marketing lists.';

create table public.email_delivery_suppressions (
  email_key text primary key check (char_length(email_key) = 64),
  reason text not null check (reason in ('bounce', 'complaint', 'manual')),
  source text not null default 'resend',
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
comment on table public.email_delivery_suppressions is 'Hashed addresses Readli no longer emails after a hard bounce or spam complaint.';

create table public.email_events (
  id bigint generated always as identity primary key,
  provider_event_id text not null unique,
  type text not null,
  provider_ref text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
comment on table public.email_events is 'Resend webhook events (delivered, bounced, complained), stored once each.';

alter table public.voice_recording_deletions enable row level security;
alter table public.lifecycle_exceptions enable row level security;
alter table public.lifecycle_runs enable row level security;
alter table public.email_delivery_suppressions enable row level security;
alter table public.email_events enable row level security;
revoke all on public.voice_recording_deletions from anon, authenticated;
revoke all on public.lifecycle_exceptions from anon, authenticated;
revoke all on public.lifecycle_runs from anon, authenticated;
revoke all on public.email_delivery_suppressions from anon, authenticated;
revoke all on public.email_events from anon, authenticated;

alter table public.email_outbox drop constraint if exists email_outbox_recipient_user_id_fkey;
alter table public.email_outbox add constraint email_outbox_recipient_user_id_fkey
  foreign key (recipient_user_id) references auth.users (id) on delete set null;

create or replace view public.voice_recordings_usable with (security_invoker = true) as
  select
    s.id as session_id,
    s.owner_id as contributor_id,
    s.voice_profile_id,
    g.storage_key,
    g.mime_type,
    g.duration_ms,
    s.recorded_duration_ms,
    s.language,
    s.transcript,
    s.quality,
    s.capture,
    s.agreement_version as recorded_under_version,
    s.created_at as recorded_at,
    c.id as current_agreement_id,
    c.agreement_version as current_agreement_version,
    c.readli_development_rights,
    c.third_party_licensing
  from public.voice_training_sessions s
  join public.voice_training_segments g on g.session_id = s.id
  join public.voice_rights_current c on c.contributor_id = s.owner_id
  join public.voice_profiles v on v.id = s.voice_profile_id
  where v.status in ('processing', 'ready')
    and s.owner_id is not null
    and s.guest_session_id is null
    and s.recording_mode in ('family_short', 'premium_private')
    and s.source_kind = 'original_human'
    and s.agreement_id is not null
    and s.recording_deleted_at is null
    and c.service_rights
    and not exists (
      select 1 from public.voice_recording_deletions d
      where d.status = 'pending' and d.owner_id = s.owner_id
        and (d.voice_id is null or d.voice_id = s.voice_profile_id)
    );
comment on view public.voice_recordings_usable is
  'Original adult recordings with the rights currently in force. Filter readli_development_rights or third_party_licensing. Withdrawn or deleted voices, recordings with a pending or completed deletion request, guest demo recordings and children never appear.';
revoke all on public.voice_recordings_usable from anon, authenticated;

alter table public.plan_settings add column generation_limits jsonb;
comment on column public.plan_settings.generation_limits is 'Admin-set generation safeguards (requests, characters, request size, concurrency, daily spend). Missing keys use the defaults in plan.ts.';

alter table public.voice_profiles add column new_stories_paused_at timestamptz;
comment on column public.voice_profiles.new_stories_paused_at is 'The owner stopped new stories in this voice for every family (Stop sharing my voice). Its clone is retired; stories already prepared keep playing. Cleared when they allow new stories again.';

alter table public.permission_audit_log drop constraint if exists permission_audit_log_action_check;
alter table public.permission_audit_log add constraint permission_audit_log_action_check check (action in (
  'voice_shared', 'voice_unshared', 'child_voice_approved', 'child_voice_removed',
  'narration_authorized', 'narration_denied', 'narration_requested', 'narration_canceled',
  'narrator_activated', 'narrator_released', 'narrator_slot_added', 'child_profile_created',
  'child_profile_removed', 'entitlement_granted', 'credits_purchased', 'voice_withdrawn', 'plan_changed',
  'voice_paused', 'voice_resumed'
));

create or replace function public.narration_spend_since(p_since timestamptz)
returns table (usd numeric, characters bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(u.usd), 0), coalesce(sum(u.characters), 0)::bigint
  from public.narration_provider_usage u
  where u.at >= p_since
$$;
comment on function public.narration_spend_since(timestamptz) is 'Voice-provider spend and characters across every household since a time, for the daily spending safeguard.';
revoke all on function public.narration_spend_since(timestamptz) from public, anon, authenticated;
create index if not exists narration_provider_usage_at on public.narration_provider_usage (at);
