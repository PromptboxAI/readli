create table public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  ask text not null check (ask in ('FB1', 'W2')),
  score smallint check (score between 0 and 10),
  reason text check (reason is null or char_length(reason) <= 40),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index feedback_responses_created on public.feedback_responses (created_at);
comment on table public.feedback_responses is 'Answers to "How are bedtimes going?" (FB1, a 0 to 10 score) and "Did Readli fit your evenings?" (W2, a reason). Everyone who is asked sees the same thanks, whatever they answer.';

alter table public.feedback_responses enable row level security;
revoke all on public.feedback_responses from anon, authenticated;
