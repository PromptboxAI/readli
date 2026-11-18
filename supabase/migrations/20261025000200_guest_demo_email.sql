alter table public.email_outbox
  add column guest_session_id uuid references public.guest_sessions (id) on delete cascade;
create index email_outbox_guest_session on public.email_outbox (guest_session_id) where guest_session_id is not null;

create table public.guest_demo_emails (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid not null unique references public.guest_sessions (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  email_hash text not null check (char_length(email_hash) = 64),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index guest_demo_emails_email_hash on public.guest_demo_emails (email_hash, created_at);
comment on table public.guest_demo_emails is 'A guest asked to have their demo emailed. Only hashes are kept here; the link stops working when the guest session expires, and the row and the queued email are deleted with the session.';

create table public.email_marketing_contacts (
  email_hash text primary key check (char_length(email_hash) = 64),
  email_encrypted text not null,
  source text not null check (source in ('guest_demo')),
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
comment on table public.email_marketing_contacts is 'People without a Readli account who opted in to Bedtime Thursdays and news, with where they did. Kept apart from delivery addresses.';

alter table public.guest_demo_emails enable row level security;
alter table public.email_marketing_contacts enable row level security;
revoke all on public.guest_demo_emails from anon, authenticated;
revoke all on public.email_marketing_contacts from anon, authenticated;
