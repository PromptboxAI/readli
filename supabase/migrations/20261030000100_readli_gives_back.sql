alter table public.complimentary_batches add column if not exists program text check (program in ('readli_gives_back'));
alter table public.complimentary_batches add column if not exists supporting_name text check (char_length(supporting_name) <= 120);

create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^RGB-[0-9A-Z]{6}$'),
  status text not null default 'pending' check (status in ('pending', 'needs_info', 'approved', 'rejected')),
  status_token_hash text not null unique check (char_length(status_token_hash) = 64),
  org_name text not null check (char_length(org_name) between 1 and 160),
  org_type text not null check (org_type in ('school', 'preschool', 'pta', 'library', 'nonprofit', 'hospital', 'committee', 'youth', 'other')),
  org_website text check (char_length(org_website) <= 300),
  org_proof text check (char_length(org_proof) <= 600),
  org_ein text check (char_length(org_ein) <= 20),
  org_street text check (char_length(org_street) <= 200),
  org_city text check (char_length(org_city) <= 100),
  org_state text check (org_state ~ '^[A-Z]{2}$'),
  org_zip text check (org_zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  contact_role text check (char_length(contact_role) <= 120),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_phone text check (char_length(contact_phone) <= 40),
  event_name text not null check (char_length(event_name) between 1 and 160),
  event_type text not null check (event_type in ('raffle', 'silent_auction', 'live_auction', 'tricky_tray', 'basket_dinner', 'gala', 'school_fair', 'online', 'other')),
  event_date date not null,
  beneficiary text not null check (char_length(beneficiary) between 1 and 200),
  event_location text check (char_length(event_location) <= 160),
  event_online boolean not null default false,
  event_url text check (char_length(event_url) <= 300),
  attendance integer check (attendance between 0 and 1000000),
  donation_use text check (donation_use in ('raffle', 'silent_auction', 'live_auction', 'tricky_tray', 'gift_basket', 'door_prize', 'other')),
  flyer_path text check (char_length(flyer_path) <= 300),
  certificate_delivery text not null default 'email' check (certificate_delivery in ('email', 'download')),
  certificate_org_name text check (char_length(certificate_org_name) <= 120),
  notes text check (char_length(notes) <= 2000),
  flags jsonb not null default '[]',
  event_key text not null check (char_length(event_key) <= 400),
  info_request text check (char_length(info_request) <= 2000),
  applicant_reply text check (char_length(applicant_reply) <= 2000),
  reply_path text check (char_length(reply_path) <= 300),
  decision_reason text check (char_length(decision_reason) <= 2000),
  batch_id uuid references public.complimentary_batches (id) on delete set null,
  gift_id uuid references public.gifts (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_by_email text,
  decided_at timestamptz,
  client_hash text check (char_length(client_hash) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.donation_requests enable row level security;
create index if not exists donation_requests_recent on public.donation_requests (created_at desc);
create index if not exists donation_requests_status on public.donation_requests (status, created_at desc);
create index if not exists donation_requests_event_key on public.donation_requests (event_key);
create index if not exists donation_requests_contact on public.donation_requests (lower(contact_email));
create index if not exists donation_requests_org on public.donation_requests (lower(org_name));
create unique index if not exists donation_requests_one_per_event on public.donation_requests (event_key) where status = 'approved';
create unique index if not exists donation_requests_batch on public.donation_requests (batch_id) where batch_id is not null;

create table if not exists public.donation_activity_log (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.donation_requests (id) on delete cascade,
  actor text not null check (actor in ('applicant', 'system', 'admin')),
  actor_email text,
  action text not null check (action in ('submitted', 'flagged', 'info_requested', 'applicant_replied', 'approved', 'rejected', 'certificate_issued', 'certificate_emailed', 'certificate_downloaded', 'redeemed', 'note')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.donation_activity_log enable row level security;
create index if not exists donation_activity_log_request on public.donation_activity_log (request_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('donation-documents', 'donation-documents', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

insert into public.email_switches (email_id, enabled) values
  ('D1', true), ('D2', true), ('D3', true), ('D4', true), ('D6', true)
on conflict (email_id) do nothing;
