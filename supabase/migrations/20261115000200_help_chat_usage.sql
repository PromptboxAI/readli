create table if not exists public.help_chat_usage (
  day date primary key,
  replies integer not null default 0,
  usd numeric(12, 6) not null default 0
);

alter table public.help_chat_usage enable row level security;

create or replace function public.add_help_chat_usage(p_day date, p_usd numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  insert into help_chat_usage (day, replies, usd)
  values (p_day, 1, greatest(p_usd, 0))
  on conflict (day) do update
    set replies = help_chat_usage.replies + 1,
        usd = help_chat_usage.usd + greatest(excluded.usd, 0)
  returning usd;
$$;

revoke all on function public.add_help_chat_usage(date, numeric) from public, anon, authenticated;
grant execute on function public.add_help_chat_usage(date, numeric) to service_role;
