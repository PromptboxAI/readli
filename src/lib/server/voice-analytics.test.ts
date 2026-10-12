import { describe, expect, it } from "vitest";
import { MemoryGuestStore } from "./guest-store";
import { cleanProperties, summarizeVoiceEvents } from "./voice-analytics";

describe("voice quality analytics", () => {
  it("keeps only short, flat properties", () => {
    const long = "x".repeat(200);
    expect(
      cleanProperties({ where: "guest_preview", ok: true, n: 3, bad: Number.NaN, "no key": 1, nested: { a: 1 }, text: long, issues: ["noisy", 4, "clipping"] }),
    ).toEqual({ where: "guest_preview", ok: true, n: 3, text: "x".repeat(80), issues: ["noisy", "clipping"] });
    expect(cleanProperties("nope")).toEqual({});
  });

  it("summarizes retries, acceptance, feedback and preview cost", () => {
    const m = summarizeVoiceEvents(
      [
        { name: "recording_submitted", properties: { surface: "guest" } },
        { name: "recording_submitted", properties: { surface: "account", afterFeedback: true } },
        { name: "recording_restarted", properties: {} },
        { name: "quality_warning_shown", properties: { issues: ["noisy", "clipping"] } },
        { name: "quality_warning_shown", properties: { issues: ["noisy"] } },
        { name: "voice_cloned", properties: { surface: "account" } },
        { name: "voice_kept", properties: {} },
        { name: "voice_kept", properties: {} },
        { name: "voice_discarded", properties: {} },
        { name: "doesnt_sound_like_me", properties: {} },
        { name: "preview_generated", properties: { characters: 600, usd: 0.06 } },
        { name: "preview_generated", properties: { characters: 400, usd: 0.04 } },
        { name: "preview_replayed", properties: {} },
      ],
      30,
    );
    expect(m.recordings).toEqual({ guest: 1, account: 1 });
    expect(m.rerecordsAfterFeedback).toBe(1);
    expect(m.restarts).toBe(1);
    expect(m.warnings).toEqual({ noisy: 2, clipping: 1 });
    expect(m.clones).toEqual({ guest: 0, account: 1 });
    expect(m.acceptanceRate).toBeCloseTo(2 / 3);
    expect(m.doesntSoundLikeMe).toBe(1);
    expect(m.previews).toEqual({ generated: 2, replayed: 1, characters: 1000, usd: 0.1 });
    expect(summarizeVoiceEvents([], 30).acceptanceRate).toBeNull();
  });
});

describe("demo preview allowance", () => {
  it("counts only successful new stories; a refunded failure and a cached replay are free", async () => {
    const store = new MemoryGuestStore();
    const s = await store.createSession({ tokenHash: "h", policyVersion: "v", generationsAllowed: 4 });
    expect(await store.useGeneration(s.id)).toBe(true);
    await store.refundGeneration(s.id);
    for (let i = 0; i < 4; i++) expect(await store.useGeneration(s.id)).toBe(true);
    expect(await store.useGeneration(s.id)).toBe(false);

    expect(await store.findPreview(s.id, "k-moon")).toBeNull();
    await store.savePreview(s.id, "k-moon", new Uint8Array([1, 2, 3]).buffer, "audio/mpeg");
    const cached = await store.findPreview(s.id, "k-moon");
    expect(cached?.contentType).toBe("audio/mpeg");
  });
});
