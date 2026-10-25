create table public.email_signups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  intent text not null check (intent in ('family', 'voice', 'voice_invited')),
  created_at timestamptz not null default now()
);
create index email_signups_created on public.email_signups (created_at);
comment on table public.email_signups is 'New grown-up accounts and which signup they came through, so onboarding email can tell a Readli Family signup from a free Readli Voice contributor. Recorded only for accounts created in the last day.';

alter table public.email_signups enable row level security;
revoke all on public.email_signups from anon, authenticated;
