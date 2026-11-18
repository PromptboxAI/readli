insert into public.email_switches (email_id, enabled) values ('M1', true)
on conflict (email_id) do nothing;
