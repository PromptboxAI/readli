alter table public.voice_candidates
  add column if not exists agreement_id uuid references public.voice_rights_agreements (id) on delete set null,
  add column if not exists audio_bytes integer,
  add column if not exists quality jsonb,
  add column if not exists user_agent text,
  add column if not exists origin text not null default 'account' check (origin in ('account', 'guest_demo'));
comment on column public.voice_candidates.agreement_id is 'The Voice Recording and AI Training Agreement accepted before this take. It must still be in force when the owner keeps the candidate.';
