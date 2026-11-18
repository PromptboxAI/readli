create table public.voice_home_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  welcomed_at timestamptz,
  story_heard_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.voice_home_progress is 'Getting-started progress for a free Readli Voice account on its Home: when it saw the welcome, first heard a story there, and hid the checklist.';

alter table public.voice_home_progress enable row level security;
revoke all on public.voice_home_progress from anon, authenticated;

create trigger voice_home_progress_updated before update on public.voice_home_progress for each row execute function public.set_updated_at();
