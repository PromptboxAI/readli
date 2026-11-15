create table if not exists public.site_banner (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  message text not null default '' check (char_length(message) <= 200),
  link_text text not null default '' check (char_length(link_text) <= 40),
  link_url text not null default '' check (char_length(link_url) <= 300),
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.site_banner (id, enabled, message, link_text, link_url, ends_at)
values (true, true, 'Giving Readli this Christmas? Give the grandkids your voice, every night of the year.', 'See Readli gifts', '/gifts', '2026-12-26 00:00:00-05')
on conflict (id) do nothing;
alter table public.site_banner enable row level security;
