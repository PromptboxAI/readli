create table if not exists public.demo_settings (
  id boolean primary key default true check (id),
  previews_allowed integer not null default 4 check (previews_allowed between 1 and 12),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
insert into public.demo_settings (id) values (true) on conflict (id) do nothing;
alter table public.demo_settings enable row level security;

alter table public.guest_sessions alter column generations_allowed set default 4;

create table if not exists public.voice_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider_voice_id_encrypted bytea not null,
  storage_key text not null,
  mime_type text not null default 'audio/webm',
  consent_receipt_id uuid references public.consent_receipts (id) on delete set null,
  remove_background_noise boolean not null default false,
  duration_ms integer,
  teleprompter_wpm integer,
  pause_count integer not null default 0,
  device_class text,
  script_offset_end integer,
  created_at timestamptz not null default now()
);
create index if not exists voice_candidates_owner on public.voice_candidates (owner_id, created_at desc);
alter table public.voice_candidates enable row level security;
