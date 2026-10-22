create table public.story_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  book_slug text not null check (char_length(book_slug) between 1 and 120),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index story_requests_household on public.story_requests (household_id);
alter table public.story_requests enable row level security;
create policy story_requests_member_read on public.story_requests for select
  using (public.is_active_member(auth.uid(), household_id));
