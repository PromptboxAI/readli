-- Guest demo backend (Phase 2): script seed and atomic preview-quota helpers.
-- Timestamped after the storage bucket migration (20261010000100_storage.sql).

-- Seed the guest teleprompter script so recording sessions can reference it.
-- src/lib/content/voice-scripts.ts mirrors this row; edit both together until the admin page exists.
insert into public.voice_scripts (slug, recording_mode, locale)
values ('guest_short.en', 'guest_short', 'en')
on conflict (slug) do nothing;

insert into public.voice_script_versions (script_id, version, body, word_count, published_at)
select id, 2, '["Once upon a time, in a little house at the edge of a sleepy town, there lived a family who loved stories more than anything. Every night, just after the moon peeked over the rooftops, someone would pick up a book, settle into the big blue chair, and begin to read.","Do you remember the first story you ever loved? Maybe it was about a brave rabbit, or a girl who tumbled down a hole, or a bear who couldn’t stop thinking about honey. I still remember mine. I must have asked for it a hundred times.","And then, one evening, something wonderful happened. The book began to glow, soft and golden. Oh, look at that! The pages are turning all by themselves. Hold on tight, everybody. Here we go.","On Tuesday the fourteenth, at half past seven, Grandma Rosa, Uncle Theo and little June counted the stars together: one, two, three, four, five, all the way to twenty-seven before June fell fast asleep.","Some stories are short. Some take three whole weeks to finish. But the best ones always feel like home. So find a cozy spot, take a slow breath, and whenever you’re ready, turn the page. The next adventure is waiting just for you. Goodnight, and sweet dreams."]'::jsonb, 211, now()
from public.voice_scripts where slug = 'guest_short.en'
on conflict (script_id, version) do nothing;

-- Spend one guest preview only while under the cap, in a single statement so
-- two parallel requests cannot both take the last one.
create or replace function public.use_guest_generation(p_session uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with spent as (
    update public.guest_sessions
    set generations_used = generations_used + 1
    where id = p_session and generations_used < generations_allowed and expires_at > now()
    returning 1
  )
  select exists (select 1 from spent);
$$;

-- Give a preview back when synthesis fails, so a provider error never costs the guest.
create or replace function public.refund_guest_generation(p_session uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.guest_sessions
  set generations_used = greatest(generations_used - 1, 0)
  where id = p_session;
$$;

revoke all on function public.use_guest_generation(uuid) from public, anon, authenticated;
revoke all on function public.refund_guest_generation(uuid) from public, anon, authenticated;
