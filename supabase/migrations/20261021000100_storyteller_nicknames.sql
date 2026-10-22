alter table public.household_members
  add column if not exists storyteller_nickname text
  check (storyteller_nickname is null or char_length(storyteller_nickname) between 1 and 40);
