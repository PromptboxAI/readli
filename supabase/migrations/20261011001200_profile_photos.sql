alter table public.adult_profiles
  add column if not exists avatar_path text,
  add column if not exists photo_consent_at timestamptz;

alter table public.adult_profiles drop constraint if exists adult_profiles_photo_consent;
alter table public.adult_profiles add constraint adult_profiles_photo_consent
  check (avatar_path is null or photo_consent_at is not null);

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false;
  end if;
end;
$$;
