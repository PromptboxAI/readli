alter table public.child_book_progress add column if not exists listened_at timestamptz;

create table if not exists public.adult_book_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  book_slug text not null,
  sentence integer not null default 0 check (sentence >= 0),
  voice_id uuid references public.voice_profiles (id) on delete set null,
  text_revision text,
  listened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, household_id, book_slug)
);

alter table public.adult_book_progress enable row level security;

drop policy if exists adult_progress_own_read on public.adult_book_progress;
create policy adult_progress_own_read on public.adult_book_progress for select
  using (user_id = auth.uid());

create or replace function public.save_child_place(
  p_child uuid,
  p_book text,
  p_sentence integer,
  p_voice uuid,
  p_revision text,
  p_listened_at timestamptz
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with saved as (
    insert into public.child_book_progress as p (child_id, book_slug, sentence, voice_id, text_revision, listened_at, updated_at)
    values (p_child, p_book, p_sentence, p_voice, p_revision, p_listened_at, now())
    on conflict (child_id, book_slug) do update
      set sentence = excluded.sentence,
          voice_id = excluded.voice_id,
          text_revision = excluded.text_revision,
          listened_at = excluded.listened_at,
          updated_at = now()
      where p.listened_at is null or p.listened_at <= excluded.listened_at
    returning 1
  )
  select exists (select 1 from saved);
$$;

create or replace function public.save_adult_place(
  p_user uuid,
  p_household uuid,
  p_book text,
  p_sentence integer,
  p_voice uuid,
  p_revision text,
  p_listened_at timestamptz
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with saved as (
    insert into public.adult_book_progress as p (user_id, household_id, book_slug, sentence, voice_id, text_revision, listened_at, updated_at)
    values (p_user, p_household, p_book, p_sentence, p_voice, p_revision, p_listened_at, now())
    on conflict (user_id, household_id, book_slug) do update
      set sentence = excluded.sentence,
          voice_id = excluded.voice_id,
          text_revision = excluded.text_revision,
          listened_at = excluded.listened_at,
          updated_at = now()
      where p.listened_at <= excluded.listened_at
    returning 1
  )
  select exists (select 1 from saved);
$$;

revoke all on function public.save_child_place(uuid, text, integer, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.save_adult_place(uuid, uuid, text, integer, uuid, text, timestamptz) from public, anon, authenticated;
