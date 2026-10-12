create table if not exists public.finance_settings (
  id boolean primary key default true check (id),
  provider_plan_name text not null default 'Creator',
  provider_plan_monthly_usd numeric(10, 2) not null default 22 check (provider_plan_monthly_usd >= 0),
  cost_per_1k_chars_usd numeric(10, 4) not null default 0.10 check (cost_per_1k_chars_usd >= 0),
  low_cost_per_1k_chars_usd numeric(10, 4) not null default 0.05 check (low_cost_per_1k_chars_usd >= 0),
  storage_usd_per_gb_month numeric(10, 4) not null default 0.021 check (storage_usd_per_gb_month >= 0),
  delivery_usd_per_gb numeric(10, 4) not null default 0.09 check (delivery_usd_per_gb >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.finance_settings default values on conflict (id) do nothing;
alter table public.finance_settings enable row level security;
