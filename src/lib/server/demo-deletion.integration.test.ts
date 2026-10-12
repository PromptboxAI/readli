import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { SupabaseAccountVoiceStore, cleanupStaleCandidates, type AccountVoiceDeps } from "@/lib/voice/account-voices";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { serverConfig } from "./config";
import { cleanupAlert, cleanupExpiredGuests } from "./guest-demo";
import { SupabaseGuestStore } from "./guest-store";
import { DEMO_DELETION_PROMISE_MS, GUEST_TTL_MS } from "./guest-token";
import { ProviderRefCipher } from "./provider-ref";

/**
 * End-to-end demo deletion through the Supabase store code paths (Kevin, 2026-10-12): original guest
 * takes and generated demo audio in Storage, the ElevenLabs clone, the database rows and unkept account
 * candidates. Runs against the in-memory Supabase fake, which keeps Storage files and cascades deletes
 * the way the migrations declare (guest_sessions to guest_assets, consent_receipts, voice_training_sessions).
 */
const SECRET = "test-secret-at-least-32-characters-long";
const HOUR = 60 * 60 * 1000;
const config = serverConfig({ VOICE_PROVIDER: "stub" } as unknown as NodeJS.ProcessEnv);
const take = { durationMs: 60_000, mimeType: "audio/webm", teleprompterWpm: 140, pauseCount: 0, deviceClass: "phone" as const, scriptOffsetEnd: 900 };

function setup(failRemove?: (bucket: string, key: string) => boolean) {
  const fake = fakeSupabase(
    { voice_script_versions: [{ id: "script-v", version: DEMO_SCRIPT.version, "voice_scripts.slug": "guest_short.en" }] },
    {
      cascade: {
        guest_sessions: [
          ["guest_assets", "guest_session_id"],
          ["consent_receipts", "guest_session_id"],
          ["voice_training_sessions", "guest_session_id"],
        ],
      },
      failRemove: (b, k) => failRemove?.(b, k) ?? false,
    },
  );
  return { ...fake, store: new SupabaseGuestStore(fake.db, SECRET) };
}

/** A demo with one take, one generated story and one provider clone, started `startedHoursAgo` ago. */
async function demo(store: SupabaseGuestStore, tables: Record<string, Record<string, unknown>[]>, voiceId: string, startedHoursAgo: number) {
  const s = await store.createSession({ tokenHash: `hash-${voiceId}`, policyVersion: "v", generationsAllowed: 2 });
  await store.saveRecording(s.id, new Blob(["take"], { type: "audio/webm" }), take);
  await store.savePreview(s.id, `${voiceId}_peter`, new ArrayBuffer(4), "audio/mpeg");
  await store.setVoice(s.id, voiceId);
  const expiresAt = new Date(Date.now() - startedHoursAgo * HOUR + GUEST_TTL_MS).toISOString();
  for (const r of (tables.guest_sessions ?? [])) if (r.id === s.id) r.expires_at = expiresAt;
  for (const r of (tables.guest_assets ?? [])) if (r.guest_session_id === s.id) r.expires_at = expiresAt;
  return s.id;
}

const rowsFor = (tables: Record<string, Record<string, unknown>[]>, id: string) =>
  ["guest_assets", "consent_receipts", "voice_training_sessions"].flatMap((t) => (tables[t] ?? []).filter((r) => r.guest_session_id === id));

describe("demo deletion end to end", () => {
  it("deletes the take, the generated audio, the clone and every database row of an expired demo", async () => {
    const { store, tables, files, removed } = setup();
    const provider = new StubVoiceProvider();
    const id = await demo(store, tables, "clone-1", 25);
    const keep = await demo(store, tables, "clone-live", 1);
    const before = (files["guest-recordings"] ?? []).filter((k) => k.startsWith(`${id}/`));
    expect(before.some((k) => k.endsWith(".webm"))).toBe(true);
    expect(before).toContain(`${id}/previews/clone-1_peter.mp3`);
    expect(rowsFor(tables, id).length).toBe(5);

    const result = await cleanupExpiredGuests({ config, store, provider });

    expect(result).toEqual({ deleted: 1, failed: 0, backlog: false, overdue: 0 });
    expect(provider.deleted).toEqual(["clone-1"]);
    expect((files["guest-recordings"] ?? []).filter((k) => k.startsWith(`${id}/`))).toEqual([]);
    expect(removed["guest-recordings"]).toEqual(expect.arrayContaining(before));
    expect((tables.guest_sessions ?? []).some((r) => r.id === id)).toBe(false);
    expect(rowsFor(tables, id)).toEqual([]);
    // A demo still within its time is untouched.
    expect((tables.guest_sessions ?? []).some((r) => r.id === keep)).toBe(true);
    expect((files["guest-recordings"] ?? []).filter((k) => k.startsWith(`${keep}/`)).length).toBe(2);
  });

  it("also deletes a stray file in the demo's folder that has no database row", async () => {
    const { store, tables, files } = setup();
    const id = await demo(store, tables, "clone-2", 25);
    files["guest-recordings"]!.push(`${id}/orphan.webm`, `${id}/previews/orphan.mp3`);
    await cleanupExpiredGuests({ config, store, provider: new StubVoiceProvider() });
    expect((files["guest-recordings"] ?? []).filter((k) => k.startsWith(`${id}/`))).toEqual([]);
  });

  it("keeps the encrypted clone reference until the provider deletion succeeds, then retries and alerts", async () => {
    const { store, tables, files } = setup();
    let down = true;
    const deleted: string[] = [];
    const provider = Object.assign(new StubVoiceProvider(), {
      deleteVoice: async (v: string) => {
        if (down) throw new Error("ElevenLabs unavailable");
        deleted.push(v);
      },
    });
    const id = await demo(store, tables, "clone-3", 49);

    const failed = await cleanupExpiredGuests({ config, store, provider });
    expect(failed).toEqual({ deleted: 0, failed: 1, backlog: false, overdue: 1 });
    expect(cleanupAlert(failed, null, false)).toMatch(/couldn't be deleted[\s\S]*past the 48-hour/);
    const voice = (tables.guest_assets ?? []).find((r) => r.guest_session_id === id && r.kind === "provider_voice")!;
    expect(voice.deletion_state).toBe("failed");
    expect(new ProviderRefCipher(SECRET).decrypt(voice.provider_ref_encrypted as string)).toBe("clone-3");
    // Nothing else was deleted ahead of the clone, so the next run starts from the same place.
    expect((files["guest-recordings"] ?? []).filter((k) => k.startsWith(`${id}/`)).length).toBe(2);

    down = false;
    expect(await cleanupExpiredGuests({ config, store, provider })).toEqual({ deleted: 1, failed: 0, backlog: false, overdue: 0 });
    expect(deleted).toEqual(["clone-3"]);
    expect(rowsFor(tables, id)).toEqual([]);
  });

  it("when Storage fails after the clone is gone, keeps the rows and does not delete the clone twice", async () => {
    let storageDown = true;
    const { store, tables, files } = setup(() => storageDown);
    const provider = new StubVoiceProvider();
    const id = await demo(store, tables, "clone-4", 25);

    expect((await cleanupExpiredGuests({ config, store, provider })).failed).toBe(1);
    expect(provider.deleted).toEqual(["clone-4"]);
    expect((tables.guest_assets ?? []).find((r) => r.guest_session_id === id && r.kind === "provider_voice")?.deletion_state).toBe("deleted");
    expect((tables.guest_assets ?? []).filter((r) => r.guest_session_id === id && r.storage_key).length).toBe(2);

    storageDown = false;
    expect((await cleanupExpiredGuests({ config, store, provider })).deleted).toBe(1);
    expect(provider.deleted).toEqual(["clone-4"]);
    expect((files["guest-recordings"] ?? []).filter((k) => k.startsWith(`${id}/`))).toEqual([]);
    expect(rowsFor(tables, id)).toEqual([]);
  });

  it("counts a demo as overdue only once it is 48 hours past its start", async () => {
    const { store, tables } = setup();
    const down = Object.assign(new StubVoiceProvider(), { deleteVoice: async () => Promise.reject(new Error("down")) });
    await demo(store, tables, "clone-5", 47);
    expect((await cleanupExpiredGuests({ config, store, provider: down })).overdue).toBe(0);
    const later = Date.now() + 2 * HOUR;
    expect((await cleanupExpiredGuests({ config, store, provider: down }, 50, 45_000, () => later)).overdue).toBe(1);
  });
});

describe("unkept account recordings", () => {
  function accounts(failRemove?: (bucket: string, key: string) => boolean) {
    const cipher = new ProviderRefCipher(SECRET);
    const old = new Date(Date.now() - 25 * HOUR).toISOString();
    const fresh = new Date(Date.now() - HOUR).toISOString();
    const fake = fakeSupabase(
      {
        voice_candidates: [
          { id: "c-old", owner_id: "u1", provider_voice_id_encrypted: cipher.encrypt("cand-old"), storage_key: "u1/old.webm", created_at: old },
          { id: "c-new", owner_id: "u2", provider_voice_id_encrypted: cipher.encrypt("cand-new"), storage_key: "u2/new.webm", created_at: fresh },
        ],
      },
      { files: { "voice-recordings": ["u1/old.webm", "u2/new.webm"] }, failRemove },
    );
    const provider = new StubVoiceProvider();
    const deps = { store: new SupabaseAccountVoiceStore(fake.db, SECRET), provider } as unknown as AccountVoiceDeps;
    return { ...fake, deps, provider };
  }

  it("deletes a candidate left for a day: its clone, its recording and its row", async () => {
    const { deps, provider, tables, files } = accounts();
    expect(await cleanupStaleCandidates(deps)).toEqual({ deleted: 1, failed: 0 });
    expect(provider.deleted).toEqual(["cand-old"]);
    expect((files["voice-recordings"] ?? [])).toEqual(["u2/new.webm"]);
    expect((tables.voice_candidates ?? []).map((r) => r.id)).toEqual(["c-new"]);
  });

  it("keeps the candidate row, the only reference to its clone and recording, when a deletion step fails", async () => {
    let down = true;
    const { deps, tables, files } = accounts(() => down);
    const result = await cleanupStaleCandidates(deps);
    expect(result).toEqual({ deleted: 0, failed: 1 });
    expect(cleanupAlert(null, result, false)).toContain("unkept account recording");
    expect((tables.voice_candidates ?? []).map((r) => r.id)).toEqual(["c-old", "c-new"]);
    down = false;
    expect(await cleanupStaleCandidates(deps)).toEqual({ deleted: 1, failed: 0 });
    expect((files["voice-recordings"] ?? [])).toEqual(["u2/new.webm"]);
  });
});

describe("cleanup schedule against the 48-hour promise", () => {
  // Vercel Hobby starts a daily cron at any minute within its scheduled hour.
  const hours = (JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")).crons as { path: string; schedule: string }[])
    .filter((c) => c.path === "/api/cron/guest-cleanup")
    .map((c) => {
      const [minute, hour, ...rest] = c.schedule.split(" ");
      expect([minute, ...rest]).toEqual(["0", "*", "*", "*"]);
      return Number(hour);
    })
    .sort((a, b) => a - b);
  const longestWait = Math.max(...hours.map((h, i) => ((hours[(i + 1) % hours.length]! - h + 24) % 24 || 24) * HOUR + 59 * 60 * 1000));

  it("runs at least three times a day", () => {
    expect(hours.length).toBeGreaterThanOrEqual(3);
  });

  it("deletes every demo within 48 hours of its start, even if one run fails", () => {
    expect(GUEST_TTL_MS + longestWait).toBeLessThan(DEMO_DELETION_PROMISE_MS);
    expect(GUEST_TTL_MS + 2 * longestWait).toBeLessThan(DEMO_DELETION_PROMISE_MS);
  });

  it("matches a minute-by-minute simulation of two days of starts with worst-case run times", () => {
    let worst = 0;
    for (let start = 0; start < 48 * 60; start += 1) {
      const expiry = start + GUEST_TTL_MS / 60_000;
      // Adversarial: a run whose hour starts before expiry runs early and misses it; the first run whose
      // hour starts after expiry runs as late as it can.
      const runs = Array.from({ length: 6 }, (_, d) => hours.map((h) => (d * 24 + h) * 60)).flat();
      const deleted = runs.find((r) => r >= expiry)! + 59;
      worst = Math.max(worst, deleted - start);
    }
    expect(worst * 60_000).toBeLessThanOrEqual(GUEST_TTL_MS + longestWait);
    expect(worst * 60_000).toBeLessThan(DEMO_DELETION_PROMISE_MS);
  });
});
