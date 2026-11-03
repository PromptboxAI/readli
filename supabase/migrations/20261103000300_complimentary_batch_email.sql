insert into public.email_switches (email_id, enabled) values ('M3', true)
on conflict (email_id) do nothing;
