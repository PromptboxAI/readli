insert into public.email_switches (email_id, enabled) values ('D8', true)
on conflict (email_id) do nothing;
