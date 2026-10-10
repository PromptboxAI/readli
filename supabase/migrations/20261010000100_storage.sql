-- Readli storage buckets (Phase 2).
-- All buckets are private: no public URLs and no storage.objects policies, so
-- only the service role (server-side route handlers) can read or write.
-- Clients get short-lived signed URLs from the server when they need playback.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  -- Guest teleprompter takes; deleted by the TTL job with their guest session.
  ('guest-recordings', 'guest-recordings', false, 26214400,
    array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav']),
  -- Signed-in Family Voice and Premium recording segments.
  ('voice-recordings', 'voice-recordings', false, 52428800,
    array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav']),
  -- Synthesized narration returned by ElevenLabs.
  ('generated-audio', 'generated-audio', false, 52428800,
    array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'])
on conflict (id) do nothing;
