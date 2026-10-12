create table public.kids_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  registered_by uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Kids device' check (char_length(label) between 1 and 40),
  active_child_id uuid references public.child_profiles (id) on delete set null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  failed_pin_attempts integer not null default 0 check (failed_pin_attempts >= 0),
  pin_locked_until timestamptz
);
create index kids_devices_household on public.kids_devices (household_id);

create table public.kids_device_children (
  device_id uuid not null references public.kids_devices (id) on delete cascade,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  primary key (device_id, child_id)
);

create table public.household_kids_pins (
  household_id uuid primary key references public.households (id) on delete cascade,
  pin_hash text not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.kids_devices enable row level security;
alter table public.kids_device_children enable row level security;
alter table public.household_kids_pins enable row level security;
