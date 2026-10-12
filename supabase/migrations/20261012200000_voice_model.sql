alter table public.voice_profiles add column if not exists model_id text;

update public.voice_profiles set model_id = 'eleven_v4' where model_id is null and deleted_at is null;
