-- Readli foundation schema (Phase 1).
-- PRD §6 core tables needed for the guest demo, plus Amendment 001 §D recording
-- session fields. Family, billing, Premium and narrator tables arrive in later
-- phases. RLS is enabled on every table; with no policies, only the service
-- role (server-side route handlers) can read or write.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts (Supabase Auth owns identities)
-- ---------------------------------------------------------------------------
create table public.adult_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_asset_id uuid,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Guest demo
-- ---------------------------------------------------------------------------
create table public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  guest_session_id uuid,
  policy_version text not null,
  purpose text not null check (purpose in ('guest_demo_processing', 'voice_persistence', 'premium_voice', 'narrator_public')),
  adult_owner_declared boolean not null,
  accepted_fields jsonb not null default '{}'::jsonb,
  given_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or guest_session_id is not null)
);

create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  signed_id_hash text not null unique,
  consent_receipt_id uuid references public.consent_receipts (id),
  generations_used integer not null default 0,
  generations_allowed integer not null default 2,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consent_receipts
  add constraint consent_receipts_guest_session_fk
  foreign key (guest_session_id) references public.guest_sessions (id) on delete cascade;

create table public.guest_assets (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid not null references public.guest_sessions (id) on delete cascade,
  kind text not null check (kind in ('recording', 'provider_voice', 'generated_audio')),
  storage_key text,
  provider_ref_encrypted bytea,
  expires_at timestamptz not null,
  deletion_state text not null default 'active' check (deletion_state in ('active', 'queued', 'deleted', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Teleprompter scripts (Amendment 001 §A: CMS-configurable, versioned)
-- ---------------------------------------------------------------------------
create table public.voice_scripts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  recording_mode text not null check (recording_mode in ('guest_short', 'family_short', 'premium_private')),
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

create table public.voice_script_versions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.voice_scripts (id) on delete cascade,
  version integer not null,
  body jsonb not null, -- ordered paragraphs; premium scripts add session break markers
  word_count integer not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (script_id, version)
);

-- ---------------------------------------------------------------------------
-- Recording sessions (Amendment 001 §D)
-- ---------------------------------------------------------------------------
create table public.voice_training_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  guest_session_id uuid references public.guest_sessions (id) on delete cascade,
  voice_profile_id uuid, -- FK added with voice_profiles in Phase 4
  recording_mode text not null check (recording_mode in ('guest_short', 'family_short', 'premium_private')),
  script_version_id uuid not null references public.voice_script_versions (id),
  script_offset_start integer not null default 0,
  script_offset_end integer,
  teleprompter_speed integer, -- words per minute
  recorded_duration_ms integer not null default 0,
  usable_duration_ms integer not null default 0,
  pause_events_count integer not null default 0,
  device_class text check (device_class in ('phone', 'tablet', 'desktop')),
  audio_qc_status text not null default 'pending' check (audio_qc_status in ('pending', 'passed', 'failed')),
  recording_status text not null default 'draft'
    check (recording_status in ('draft', 'recording', 'paused', 'uploaded', 'qc_failed', 'accepted')),
  consent_receipt_id uuid not null references public.consent_receipts (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_id is not null) <> (guest_session_id is not null))
);

create table public.voice_training_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_training_sessions (id) on delete cascade,
  ordinal integer not null,
  storage_key text not null,
  mime_type text not null,
  duration_ms integer not null,
  usable_duration_ms integer,
  script_offset_start integer not null,
  script_offset_end integer not null,
  audio_qc_status text not null default 'pending' check (audio_qc_status in ('pending', 'passed', 'failed')),
  qc_notes jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, ordinal)
);

-- ---------------------------------------------------------------------------
-- Catalog (only what the six-book demo needs; full catalog in Phase 7)
-- ---------------------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  first_published integer,
  age_band text,
  created_at timestamptz not null default now()
);

create table public.book_editions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  source text not null default 'project_gutenberg',
  source_id text,
  provenance_url text,
  jurisdiction text[] not null default '{US}',
  rights_status text not null default 'pending_review' check (rights_status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.demo_passages (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.book_editions (id) on delete cascade,
  display_order smallint not null unique check (display_order between 1 and 6),
  passage_text text,
  target_seconds smallint not null default 45,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, description) values
  ('demo_audio', false, 'Real synthesized demo previews (Phase 2)'),
  ('premium_voice', false, 'Premium Private Voice upgrade and long-form recording (Phase 5)'),
  ('narrator_program', false, 'Public narrator applications (P2, Phase 6)');

-- Adult-only, first-party events. Never audio, transcripts or child identifiers.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null,
  user_id uuid references auth.users (id) on delete set null,
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index analytics_events_name_time on public.analytics_events (name, occurred_at);
create index guest_sessions_expiry on public.guest_sessions (expires_at);
create index guest_assets_expiry on public.guest_assets (expires_at) where deletion_state = 'active';
create index voice_training_sessions_owner on public.voice_training_sessions (owner_id) where owner_id is not null;

-- updated_at triggers
create trigger adult_profiles_updated before update on public.adult_profiles for each row execute function public.set_updated_at();
create trigger guest_sessions_updated before update on public.guest_sessions for each row execute function public.set_updated_at();
create trigger guest_assets_updated before update on public.guest_assets for each row execute function public.set_updated_at();
create trigger voice_training_sessions_updated before update on public.voice_training_sessions for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.adult_profiles enable row level security;
alter table public.consent_receipts enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.guest_assets enable row level security;
alter table public.voice_scripts enable row level security;
alter table public.voice_script_versions enable row level security;
alter table public.voice_training_sessions enable row level security;
alter table public.voice_training_segments enable row level security;
alter table public.books enable row level security;
alter table public.book_editions enable row level security;
alter table public.demo_passages enable row level security;
alter table public.feature_flags enable row level security;
alter table public.analytics_events enable row level security;

-- Adults manage only their own profile.
create policy "own profile" on public.adult_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Adults can read their own consent receipts; writes go through the server.
create policy "read own consent" on public.consent_receipts
  for select using (auth.uid() = user_id);

-- Signed-in adults can read their own recording sessions and segments.
create policy "read own sessions" on public.voice_training_sessions
  for select using (auth.uid() = owner_id);
create policy "read own segments" on public.voice_training_segments
  for select using (exists (
    select 1 from public.voice_training_sessions s where s.id = session_id and s.owner_id = auth.uid()
  ));

-- Public catalog metadata: only approved editions and published scripts.
create policy "public books" on public.books for select using (true);
create policy "approved editions" on public.book_editions for select using (rights_status = 'approved');
create policy "approved passages" on public.demo_passages for select using (approved_at is not null);
create policy "published scripts" on public.voice_script_versions for select using (published_at is not null);
create policy "public script index" on public.voice_scripts for select using (true);

-- guest_sessions, guest_assets, feature_flags, analytics_events: service role only.
