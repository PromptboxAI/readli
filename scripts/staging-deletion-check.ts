/**
 * Staging-only deletion check against the real Supabase and ElevenLabs APIs (Kevin, 2026-10-12 and
 * 2026-10-21). It makes one throwaway demo with a clone, plus one "bystander" demo with no clone, runs
 * the same clean-up code the cron runs (first with ElevenLabs deletion forced to fail, to check the
 * retry path, then for real) and checks every place the demo lived: the guest-recordings bucket, the
 * ElevenLabs voice and the guest rows. The bystander must come through untouched, then is removed.
 *
 * Never point it at production. Before creating anything it refuses to run unless:
 * - STAGING_DELETION_CHECK=yes;
 * - NEXT_PUBLIC_SUPABASE_URL equals STAGING_SUPABASE_URL and differs from PRODUCTION_SUPABASE_URL;
 * - the ElevenLabs key's workspace holds no cloned or designed voice other than earlier check clones.
 *
 *   STAGING_DELETION_CHECK=yes STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
 *   PRODUCTION_SUPABASE_URL=https://<production-ref>.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   GUEST_COOKIE_SECRET=... ELEVENLABS_API_KEY=... STAGING_SAMPLE=./sample.wav \
 *   npx tsx scripts/staging-deletion-check.ts
 *
 * STAGING_SAMPLE is the path to a .wav, .mp3 or .webm recording under 25 MB of real speech by someone
 * who agreed to it (a tone is refused by ElevenLabs).
 *
 * It only ever touches what this run created: clean-up reads and deletes only this run's sessions, and
 * every delete (the ElevenLabs voice, Storage files, the session row) is refused unless it names one of
 * them. If the run stops partway, a final step removes whatever it created; if even that fails, the
 * session and voice IDs are printed and saved in the results for removal by hand.
 *
 * Results go to staging-deletion-results.json. They hold step names, IDs, file names and counts only:
 * no keys, no audio, and any key value that slips into an error message is replaced with [redacted].
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { serverConfig } from "@/lib/server/config";
import { cleanupExpiredGuests, scopeCleanupTo } from "@/lib/server/guest-demo";
import { SupabaseGuestStore } from "@/lib/server/guest-store";
import { ElevenLabsProvider } from "@/lib/voice/elevenlabs";

const CLONE_NAME = "Readli staging deletion check";
const BUCKET = "guest-recordings";
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const host = (u: string | undefined) => {
  try {
    return u ? new URL(u).host : "";
  } catch {
    return "";
  }
};

function refuse(why: string): never {
  console.error(`Refusing to run: ${why}`);
  process.exit(2);
}
if (env.STAGING_DELETION_CHECK !== "yes") refuse("set STAGING_DELETION_CHECK=yes.");
if (!host(url) || host(url) !== host(env.STAGING_SUPABASE_URL)) refuse("NEXT_PUBLIC_SUPABASE_URL must be the same staging URL as STAGING_SUPABASE_URL.");
if (!host(env.PRODUCTION_SUPABASE_URL)) refuse("set PRODUCTION_SUPABASE_URL to the production project's URL, so the check can tell them apart.");
if (host(url) === host(env.PRODUCTION_SUPABASE_URL)) refuse("the Supabase URL is the production project.");
for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "GUEST_COOKIE_SECRET", "ELEVENLABS_API_KEY", "STAGING_SAMPLE"]) if (!env[k]) refuse(`missing ${k}.`);

const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const store = new SupabaseGuestStore(db, env.GUEST_COOKIE_SECRET!);
const eleven = new ElevenLabsProvider(env.ELEVENLABS_API_KEY!, env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2");
const config = serverConfig();
const results: { step: string; ok: boolean; detail?: unknown }[] = [];
const created: { sessionId?: string; voiceId?: string; bystanderId?: string } = {};
const check = (step: string, ok: boolean, detail?: unknown) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
};

async function elevenGet(path: string) {
  return fetch(`https://api.elevenlabs.io/v1${path}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY! } });
}
async function voiceExists(voiceId: string) {
  return (await elevenGet(`/voices/${encodeURIComponent(voiceId)}`)).status !== 404;
}
/** Every non-premade voice in the key's workspace. A staging workspace has none but earlier check clones. */
async function workspaceVoices() {
  const res = await elevenGet("/voices");
  if (!res.ok) throw new Error(`listing ElevenLabs voices returned ${res.status}; the key needs Voices: Read or Write.`);
  const { voices } = (await res.json()) as { voices: { voice_id: string; name: string; category?: string }[] };
  return voices.filter((v) => v.category !== "premade");
}
async function files(sessionId: string) {
  const top = await db.storage.from(BUCKET).list(sessionId);
  const previews = await db.storage.from(BUCKET).list(`${sessionId}/previews`);
  return [...(top.data ?? []).filter((f) => f.id), ...(previews.data ?? []).filter((f) => f.id)].map((f) => f.name);
}
async function rowCounts(sessionId: string) {
  const out: Record<string, number> = {};
  for (const [table, col] of [["guest_sessions", "id"], ["guest_assets", "guest_session_id"], ["consent_receipts", "guest_session_id"], ["voice_training_sessions", "guest_session_id"]] as const) {
    const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(col, sessionId);
    out[table] = count ?? 0;
  }
  return out;
}
async function expire(sessionId: string) {
  const past = new Date(Date.now() - 60_000).toISOString();
  await db.from("guest_sessions").update({ expires_at: past }).eq("id", sessionId);
  await db.from("guest_assets").update({ expires_at: past }).eq("guest_session_id", sessionId);
}

async function main() {
  const sample = readFileSync(env.STAGING_SAMPLE!);
  const type = ({ wav: "audio/wav", mp3: "audio/mpeg", webm: "audio/webm" } as Record<string, string>)[env.STAGING_SAMPLE!.split(".").pop()!.toLowerCase()];
  if (!type || sample.byteLength > 25 * 1024 * 1024) throw new Error("STAGING_SAMPLE must be a .wav, .mp3 or .webm file under 25 MB.");
  const take = { durationMs: 30_000, mimeType: type, teleprompterWpm: null, pauseCount: 0, deviceClass: null, scriptOffsetEnd: null };

  // Isolation, before anything is created.
  const voicesBefore = await workspaceVoices();
  const foreign = voicesBefore.filter((v) => v.name !== CLONE_NAME);
  if (foreign.length) {
    check("ElevenLabs key belongs to a workspace with no customer voices", false, { otherVoices: foreign.length });
    return;
  }
  check("ElevenLabs key belongs to a workspace with no customer voices", true, { earlierCheckClones: voicesBefore.map((v) => v.voice_id) });

  // A bystander: an expired demo this run doesn't clean up. It must come through untouched.
  const bystander = await store.createSession({ tokenHash: `staging-bystander-${Date.now()}`, policyVersion: "staging-check", generationsAllowed: 1 });
  created.bystanderId = bystander.id;
  await store.saveRecording(bystander.id, new Blob([sample], { type }), take);
  await expire(bystander.id);
  const bystanderBefore = { files: await files(bystander.id), rows: await rowCounts(bystander.id) };

  // The demo under test.
  const session = await store.createSession({ tokenHash: `staging-check-${Date.now()}`, policyVersion: "staging-check", generationsAllowed: 1 });
  created.sessionId = session.id;
  await store.saveRecording(session.id, new Blob([sample], { type }), take);
  const { voiceId } = await eleven.createInstantVoice({ name: CLONE_NAME, audio: new Blob([sample], { type }), filename: `sample.${type.split("/")[1]}`, description: "Deleted by the staging deletion check." });
  created.voiceId = voiceId;
  console.log(`Created demo session ${session.id}, bystander ${bystander.id} and ElevenLabs voice ${voiceId}.`);
  await store.setVoice(session.id, voiceId);
  const own = scopeCleanupTo(store, eleven, session.id, voiceId);
  const speech = await eleven.synthesize({ voiceId, text: "This is a staging deletion check." });
  await store.savePreview(session.id, `${voiceId}_check`, speech.audio, speech.contentType);
  check("demo created: take and generated audio in Storage", (await files(session.id)).length >= 2, await files(session.id));
  check("demo created: ElevenLabs voice exists", await voiceExists(voiceId), voiceId);

  // Expire it, then run clean-up with ElevenLabs deletion failing.
  await expire(session.id);
  const failing = Object.assign(Object.create(own.provider), { deleteVoice: async () => Promise.reject(new Error("forced failure (staging check)")) });
  const failed = await cleanupExpiredGuests({ config, store: own.store, provider: failing }, 50, 45_000);
  const { data: voiceRow } = await db.from("guest_assets").select("deletion_state, provider_ref_encrypted").eq("guest_session_id", session.id).eq("kind", "provider_voice").maybeSingle();
  check("forced failure: run reports the failure", failed.failed === 1, failed);
  check("forced failure: clone reference kept and marked failed", voiceRow?.deletion_state === "failed" && Boolean(voiceRow?.provider_ref_encrypted), voiceRow?.deletion_state);
  check("forced failure: Storage untouched", (await files(session.id)).length >= 2);
  check("forced failure: ElevenLabs voice still exists", await voiceExists(voiceId));

  // Retry for real.
  const retried = await cleanupExpiredGuests({ config, store: own.store, provider: own.provider }, 50, 45_000);
  check("retry: run reports success for this demo only", retried.deleted === 1 && retried.failed === 0, retried);
  check("retry: Storage folder empty", (await files(session.id)).length === 0, await files(session.id));
  check("retry: ElevenLabs voice gone (404)", !(await voiceExists(voiceId)));
  const rows = await rowCounts(session.id);
  check("retry: no guest rows left", Object.values(rows).every((n) => n === 0), rows);
  const bystanderAfter = { files: await files(bystander.id), rows: await rowCounts(bystander.id) };
  check("unrelated expired demo untouched", JSON.stringify(bystanderAfter) === JSON.stringify(bystanderBefore) && bystanderAfter.files.length > 0, bystanderAfter);
  const voicesAfter = await workspaceVoices();
  check("no other ElevenLabs voice deleted", voicesBefore.every((v) => v.voice_id === voiceId || voicesAfter.some((a) => a.voice_id === v.voice_id)));
}

/** Removes whatever this run created and is still there, through the same scoped clean-up. */
async function removeLeftovers() {
  const left: string[] = [];
  for (const [id, voiceId] of [[created.sessionId, created.voiceId], [created.bystanderId, undefined]] as const) {
    if (!id) continue;
    try {
      const scoped = scopeCleanupTo(store, eleven, id, voiceId ?? "");
      if (((await rowCounts(id)).guest_sessions ?? 0) > 0) {
        await expire(id);
        const r = await cleanupExpiredGuests({ config, ...scoped }, 1, 45_000);
        if (r.failed) left.push(`session ${id}`);
      }
      if (voiceId && (await voiceExists(voiceId))) await scoped.provider.deleteVoice(voiceId);
    } catch (err) {
      console.error(`Couldn't remove ${id}:`, err);
      left.push(`session ${id}`);
    }
  }
  if (created.voiceId && (await voiceExists(created.voiceId).catch(() => true))) left.push(`ElevenLabs voice ${created.voiceId}`);
  check("run left nothing behind", left.length === 0, left.length ? { removeByHand: left } : undefined);
}

function redact(text: string) {
  let out = text;
  for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "GUEST_COOKIE_SECRET", "ELEVENLABS_API_KEY"]) {
    const v = env[k];
    if (v && v.length >= 8) out = out.split(v).join("[redacted]");
  }
  return out;
}

main()
  .catch((err) => check("check stopped early", false, redact(String(err instanceof Error ? err.message : err))))
  .then(removeLeftovers)
  .catch((err) => check("removing leftovers stopped", false, redact(String(err))))
  .finally(() => {
    const report = { at: new Date().toISOString(), supabaseProject: host(url).split(".")[0], created, results };
    writeFileSync("staging-deletion-results.json", redact(JSON.stringify(report, null, 2)));
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  });
