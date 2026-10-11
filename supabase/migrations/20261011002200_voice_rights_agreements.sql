create table public.voice_rights_agreements (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references auth.users (id) on delete cascade,
  agreement_version text not null,
  event text not null check (event in ('accepted', 'updated', 'withdrawn')),
  service_rights boolean not null,
  readli_development_rights boolean not null,
  third_party_licensing boolean not null default false,
  adult_owner_declared boolean not null,
  statements jsonb not null,
  contributor_name text,
  contributor_email text,
  source text not null check (source in ('pre_recording', 'settings', 'support')),
  user_agent text,
  supersedes_id uuid references public.voice_rights_agreements (id),
  agreed_at timestamptz not null default now(),
  check (adult_owner_declared or not (service_rights or readli_development_rights or third_party_licensing)),
  check (not third_party_licensing or (service_rights and readli_development_rights)),
  check (event <> 'withdrawn' or not (service_rights or readli_development_rights or third_party_licensing))
);

create index voice_rights_agreements_contributor on public.voice_rights_agreements (contributor_id, agreed_at desc);

create or replace function public.voice_rights_agreements_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'voice_rights_agreements is append-only; insert a new row instead';
end;
$$;

create trigger voice_rights_agreements_no_update
  before update on public.voice_rights_agreements
  for each row execute function public.voice_rights_agreements_append_only();

alter table public.voice_rights_agreements enable row level security;

create policy voice_rights_own_read on public.voice_rights_agreements for select
  using (contributor_id = auth.uid());

alter table public.voice_training_sessions
  add column if not exists agreement_id uuid references public.voice_rights_agreements (id) on delete set null,
  add column if not exists agreement_version text,
  add column if not exists language text,
  add column if not exists transcript text,
  add column if not exists transcript_source text check (transcript_source in ('script', 'asr', 'manual')),
  add column if not exists quality jsonb,
  add column if not exists capture jsonb,
  add column if not exists audio_mime_type text,
  add column if not exists audio_bytes bigint,
  add column if not exists remove_background_noise boolean,
  add column if not exists source_kind text not null default 'original_human' check (source_kind in ('original_human'));

comment on column public.voice_training_sessions.transcript is 'Expected transcript: the script text read up to script_offset_end.';
comment on column public.voice_training_sessions.quality is 'Recorder and server checks: speech_ms, issues, audio_qc_status.';
comment on column public.voice_training_sessions.capture is 'Capture details: constraints, device_class, user agent, words per minute.';

create index voice_training_sessions_agreement on public.voice_training_sessions (agreement_id);

create view public.voice_rights_current with (security_invoker = true) as
  select distinct on (contributor_id) *
  from public.voice_rights_agreements
  order by contributor_id, agreed_at desc, id desc;

alter table public.voice_profiles drop constraint if exists voice_profiles_status_check;
alter table public.voice_profiles add constraint voice_profiles_status_check
  check (status in ('processing', 'ready', 'withdrawn', 'deleted'));
alter table public.voice_profiles
  add column withdrawn_at timestamptz,
  add column clone_retired_at timestamptz,
  add column unlinked_since timestamptz;

comment on column public.voice_profiles.status is 'withdrawn: the owner deleted the voice. No new narration, clone retired, recordings out of all training; prepared stories keep playing for families it was shared with. deleted: legally required removal or account deletion, stories removed too.';
comment on column public.voice_profiles.clone_retired_at is 'Provider clone retired (no Readli Family household needed it). Playback never needs it; it is re-cloned from the original recording when authorization is still valid.';
comment on column public.voice_profiles.unlinked_since is 'Since when no Readli Family household has used this voice; the lifecycle job retires the clone after plan_settings.clone_retire_after_days.';

create or replace function public.voice_rights_withdraw_on_voice_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_version text;
begin
  if new.status in ('withdrawn', 'deleted') and old.status not in ('withdrawn', 'deleted') then
    select agreement_version into current_version
      from public.voice_rights_current where contributor_id = new.owner_id;
    if current_version is not null then
      insert into public.voice_rights_agreements
        (contributor_id, agreement_version, event, service_rights, readli_development_rights,
         third_party_licensing, adult_owner_declared, statements, source, supersedes_id)
      select new.owner_id, current_version, 'withdrawn', false, false, false, true,
             jsonb_build_array(case when new.status = 'withdrawn' then 'Voice deleted by its owner' else 'Voice removed' end), 'settings', c.id
        from public.voice_rights_current c
        where c.contributor_id = new.owner_id and c.event <> 'withdrawn';
    end if;
  end if;
  return new;
end;
$$;

create trigger voice_profiles_withdraw_rights_on_delete
  after update of status on public.voice_profiles
  for each row execute function public.voice_rights_withdraw_on_voice_delete();

create view public.voice_recordings_usable with (security_invoker = true) as
  select
    s.id as session_id,
    s.owner_id as contributor_id,
    s.voice_profile_id,
    g.storage_key,
    g.mime_type,
    g.duration_ms,
    s.recorded_duration_ms,
    s.language,
    s.transcript,
    s.quality,
    s.capture,
    s.agreement_version as recorded_under_version,
    s.created_at as recorded_at,
    c.id as current_agreement_id,
    c.agreement_version as current_agreement_version,
    c.readli_development_rights,
    c.third_party_licensing
  from public.voice_training_sessions s
  join public.voice_training_segments g on g.session_id = s.id
  join public.voice_rights_current c on c.contributor_id = s.owner_id
  join public.voice_profiles v on v.id = s.voice_profile_id
  where v.status in ('processing', 'ready')
    and s.owner_id is not null
    and s.guest_session_id is null
    and s.recording_mode in ('family_short', 'premium_private')
    and s.source_kind = 'original_human'
    and s.agreement_id is not null
    and c.service_rights;

comment on view public.voice_recordings_usable is
  'Original adult recordings with the rights currently in force. Filter readli_development_rights or third_party_licensing. Withdrawn or deleted voices, guest demo recordings and children never appear.';

revoke all on public.voice_rights_current from anon, authenticated;
revoke all on public.voice_recordings_usable from anon, authenticated;

comment on table public.voice_rights_agreements is 'Voice Recording and AI Training Agreement history per contributor, append-only. Latest row per contributor is in force. Three separate rights: service, Readli development, third-party licensing (opt-in, off by default).';
