create table public.book_features (
  week_of date primary key,
  slugs text[] not null check (cardinality(slugs) = 2),
  chosen_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.book_features is 'Bedtime Thursdays: the two stories featured in the week starting on week_of (a Thursday). chosen_by is null when Readli picked the two newest itself.';

create table public.book_feature_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_of date not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, week_of)
);
comment on table public.book_feature_dismissals is 'A grown-up closed the in-app "New this week" notice for that week.';

alter table public.book_features enable row level security;
alter table public.book_feature_dismissals enable row level security;
revoke all on public.book_features from anon, authenticated;
revoke all on public.book_feature_dismissals from anon, authenticated;
