create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  email_id text not null,
  category text not null check (category in ('transactional', 'relationship', 'commercial')),
  household_id uuid references public.households (id) on delete set null,
  recipient_user_id uuid references auth.users (id) on delete cascade,
  to_email_encrypted text,
  subject text not null,
  html text not null,
  body text not null,
  headers jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'canceled')),
  attempts integer not null default 0,
  send_after timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_ref text,
  last_error text,
  last_event text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_user_id is not null or to_email_encrypted is not null)
);
create index email_outbox_due on public.email_outbox (next_attempt_at) where status in ('queued', 'failed');
create index email_outbox_provider_ref on public.email_outbox (provider_ref);
create index email_outbox_email_id on public.email_outbox (email_id, created_at);
create index email_outbox_recipient_sent on public.email_outbox (recipient_user_id, sent_at) where status = 'sent';
comment on table public.email_outbox is 'Every automated Readli email: queued once per dedupe key, checked against switches, consent, preferences, suppressions and frequency limits at send time, then sent through Resend with the row id as the idempotency key.';

create table public.email_delivery_suppressions (
  email_hash text primary key check (char_length(email_hash) = 64),
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
  received_at timestamptz not null default now()
);
create index email_events_provider_ref on public.email_events (provider_ref);
comment on table public.email_events is 'Resend webhook events (delivered, bounced, complained), stored once each, without addresses or content.';

create table public.email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  setup_reminders boolean not null default true,
  invitation_reminders boolean not null default true,
  feedback_requests boolean not null default true,
  marketing boolean not null default false,
  time_zone text check (time_zone is null or char_length(time_zone) <= 64),
  updated_at timestamptz not null default now()
);
comment on table public.email_preferences is 'Which optional Readli emails each grown-up gets. Marketing is off until they opt in; a missing row means the defaults.';

create table public.email_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  email_hash text,
  topic text not null check (topic in ('marketing', 'setup_reminders', 'invitation_reminders', 'feedback_requests')),
  granted boolean not null,
  source text not null check (source in ('signup', 'account_settings', 'email_preferences', 'one_click_unsubscribe', 'guest_demo')),
  created_at timestamptz not null default now(),
  check (user_id is not null or email_hash is not null)
);
create index email_consent_events_user on public.email_consent_events (user_id, created_at);
comment on table public.email_consent_events is 'Each time someone gives or withdraws email consent, and where.';

create table public.email_switches (
  email_id text primary key check (email_id ~ '^[A-Z]{1,2}[0-9]$'),
  enabled boolean not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table public.email_switches is 'Admin on and off switch for each automated email in the sequence matrix. No row means the email is off.';

alter table public.email_outbox enable row level security;
alter table public.email_delivery_suppressions enable row level security;
alter table public.email_events enable row level security;
alter table public.email_preferences enable row level security;
alter table public.email_consent_events enable row level security;
alter table public.email_switches enable row level security;
revoke all on public.email_outbox from anon, authenticated;
revoke all on public.email_delivery_suppressions from anon, authenticated;
revoke all on public.email_events from anon, authenticated;
revoke all on public.email_preferences from anon, authenticated;
revoke all on public.email_consent_events from anon, authenticated;
revoke all on public.email_switches from anon, authenticated;
