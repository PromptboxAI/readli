alter table public.site_banner add column if not exists style text not null default 'festive' check (style in ('festive', 'evergreen', 'starry', 'classic'));
