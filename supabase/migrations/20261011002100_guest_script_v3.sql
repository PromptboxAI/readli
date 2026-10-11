insert into public.voice_script_versions (script_id, version, body, word_count, published_at)
select v.script_id, 3, replace(v.body::text, 'Goodnight, and sweet dreams.', 'Goodnight, sleep tight, don’t let the bed bugs bite, and leave on the hall light.')::jsonb, 222, now()
from public.voice_script_versions v join public.voice_scripts s on s.id = v.script_id
where s.slug = 'guest_short.en' and v.version = 2
on conflict (script_id, version) do nothing;
