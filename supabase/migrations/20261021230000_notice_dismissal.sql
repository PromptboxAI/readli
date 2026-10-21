-- Family Home shows one combined "new readings ready" notice. Each adult dismisses it for themselves,
-- so this records how far they have seen. Hiding a notice never touches the prepared audio.
alter table public.household_members add column if not exists notices_seen_through timestamptz;
