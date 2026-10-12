/**
 * Staging-only deletion check against the real Supabase and ElevenLabs APIs (Kevin, 2026-10-12).
 * It makes one throwaway demo, runs the same clean-up code the cron runs (first with ElevenLabs
 * deletion forced to fail, to check the retry path, then for real) and checks every place the demo
 * lived: the guest-recordings bucket, the ElevenLabs voice, and the guest rows.
 *
 * Never point it at production. It refuses to run unless STAGING_DELETION_CHECK=yes and the Supabase
 * URL matches STAGING_SUPABASE_URL. Results are printed and written to staging-deletion-results.json.
 *
 *   STAGING_DELETION_CHECK=yes STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GUEST_COOKIE_SECRET=... \
 *   ELEVENLABS_API_KEY=... STAGING_SAMPLE=./sample.webm npx tsx scripts/staging-deletion-check.ts
 *
 * STAGING_SAMPLE is a short recording of real speech by someone who agreed to it (a tone is refused
 * by ElevenLabs). The clone it makes is deleted by the check.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { serverConfig } from "@/lib/server/config";
import { cleanupExpiredGuests } from "@/lib/server/guest-demo";
import { SupabaseGuestStore } from "@/lib/server/guest-store";
import { ElevenLabsProvider } from "@/lib/voice/elevenlabs";

const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (env.STAGING_DELETION_CHECK !== "yes" || !env.STAGING_SUPABASE_URL || url !== env.STAGING_SUPABASE_URL) {
  console.error("Refusing to run: set STAGING_DELETION_CHECK=yes and STAGING_SUPABASE_URL to the same staging URL as NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(2);
}
for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "GUEST_COOKIE_SECRET", "ELEVENLABS_API_KEY", "STAGING_SAMPLE"]) {
  if (!env[k]) {
    console.error(`Missing ${k}.`);
    process.exit(2);
  }
}

const BUCKET = "guest-recordings";
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const store = new SupabaseGuestStore(db, env.GUEST_COOKIE_SECRET!);
const eleven = new ElevenLabsProvider(env.ELEVENLABS_API_KEY!, env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2");
const config = serverConfig();
const results: { step: string; ok: boolean; detail?: unknown }[] = [];
const check = (step: string, ok: boolean, detail?: unknown) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
};

async function files(sessionId: string) {
  const top = await db.storage.from(BUCKET).list(sessionId);
  const previews = await db.storage.from(BUCKET).list(`${sessionId}/previews`);
  return [...(top.data ?? []).filter((f) => f.id), ...(previews.data ?? []).filter((f) => f.id)].map((f) => f.name);
}
async function voiceExists(voiceId: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY! } });
  return res.status !== 404;
}
async function rowCounts(sessionId: string) {
  const out: Record<string, number> = {};
  for (const [table, col] of [["guest_sessions", "id"], ["guest_assets", "guest_session_id"], ["consent_receipts", "guest_session_id"], ["voice_training_sessions", "guest_session_id"]] as const) {
    const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(col, sessionId);
    out[table] = count ?? 0;
  }
  return out;
}

async function main() {
  const sample = readFileSync(env.STAGING_SAMPLE!);
  const type = env.STAGING_SAMPLE!.endsWith(".wav") ? "audio/wav" : env.STAGING_SAMPLE!.endsWith(".mp3") ? "audio/mpeg" : "audio/webm";
  const session = await store.createSession({ tokenHash: `staging-check-${Date.now()}`, policyVersion: "staging-check", generationsAllowed: 1 });
  await store.saveRecording(session.id, new Blob([sample], { type }), { durationMs: 30_000, mimeType: type, teleprompterWpm: null, pauseCount: 0, deviceClass: null, scriptOffsetEnd: null });
  const { voiceId } = await eleven.createInstantVoice({ name: "Readli staging deletion check", audio: new Blob([sample], { type }), filename: `sample.${type.split("/")[1]}`, description: "Deleted by the staging deletion check." });
  await store.setVoice(session.id, voiceId);
  const speech = await eleven.synthesize({ voiceId, text: "This is a staging deletion check." });
  await store.savePreview(session.id, `${voiceId}_check`, speech.audio, speech.contentType);
  check("demo created: take and generated audio in Storage", (await files(session.id)).length >= 2, await files(session.id));
  check("demo created: ElevenLabs voice exists", await voiceExists(voiceId), voiceId);

  // Expire it, then run clean-up with ElevenLabs deletion failing.
  const past = new Date(Date.now() - 60_000).toISOString();
  await db.from("guest_sessions").update({ expires_at: past }).eq("id", session.id);
  await db.from("guest_assets").update({ expires_at: past }).eq("guest_session_id", session.id);
  const failing = Object.assign(Object.create(eleven), { deleteVoice: async () => Promise.reject(new Error("forced failure (staging check)")) });
  const failed = await cleanupExpiredGuests({ config, store, provider: failing }, 50, 45_000);
  const { data: voiceRow } = await db.from("guest_assets").select("deletion_state, provider_ref_encrypted").eq("guest_session_id", session.id).eq("kind", "provider_voice").maybeSingle();
  check("forced failure: run reports the failure", failed.failed >= 1, failed);
  check("forced failure: clone reference kept and marked failed", voiceRow?.deletion_state === "failed" && Boolean(voiceRow?.provider_ref_encrypted), voiceRow?.deletion_state);
  check("forced failure: Storage untouched", (await files(session.id)).length >= 2);
  check("forced failure: ElevenLabs voice still exists", await voiceExists(voiceId));

  // Retry for real.
  const retried = await cleanupExpiredGuests({ config, store, provider: eleven }, 50, 45_000);
  check("retry: run reports success", retried.failed === 0, retried);
  check("retry: Storage folder empty", (await files(session.id)).length === 0, await files(session.id));
  check("retry: ElevenLabs voice gone (404)", !(await voiceExists(voiceId)));
  const rows = await rowCounts(session.id);
  check("retry: no guest rows left", Object.values(rows).every((n) => n === 0), rows);

  writeFileSync("staging-deletion-results.json", JSON.stringify({ at: new Date().toISOString(), supabase: url, sessionId: session.id, results }, null, 2));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((err) => {
  console.error("Staging deletion check stopped:", err);
  process.exit(1);
});
