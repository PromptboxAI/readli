// @vitest-environment node
import { describe, expect, it } from "vitest";
import { VOICE_CONSENTS } from "@/lib/content/voice-consents";
import { MemoryGuestStore } from "@/lib/server/guest-store";
import { AccountVoiceError, MemoryAccountVoiceStore } from "./account-voices";
import { voiceFromDemo } from "./demo-voice";
import { StubVoiceProvider } from "./stub";

const limits = { minRecordingMs: 59_000, maxRecordingMs: 150_000, maxRecordingBytes: 25 * 1024 * 1024 };
const owner = { id: "11111111-2222-3333-4444-555555555555", name: "Sara" };
const meta = (durationMs: number) => ({ durationMs, mimeType: "audio/webm", teleprompterWpm: 140, pauseCount: 0, deviceClass: "phone" as const, scriptOffsetEnd: 900 });

async function setup(durationMs: number | null) {
  const guests = new MemoryGuestStore();
  const guest = await guests.createSession({ tokenHash: `t${Math.random()}`, policyVersion: "v" });
  // ~24 KB/s, like a real take, so the server's silence check passes.
  if (durationMs !== null) await guests.saveRecording(guest.id, new Blob([new Uint8Array((durationMs / 1000) * 24_000)], { type: "audio/webm" }), meta(durationMs));
  const store = new MemoryAccountVoiceStore();
  return { guests, guestId: guest.id, store, deps: { store, provider: new StubVoiceProvider(), limits } };
}

describe("voice from the demo", () => {
  it("turns the demo take into the grown-up's voice once they agree", async () => {
    const { guests, guestId, store, deps } = await setup(70_000);
    const voice = await voiceFromDemo(deps, guests, guestId, owner, { consents: VOICE_CONSENTS, removeBackgroundNoise: false });
    expect(voice.status).toBe("ready");
    expect(await store.findVoice(owner.id)).toMatchObject({ id: voice.id });
  });

  it("still needs every consent, a real minute, and a take that hasn't been deleted", async () => {
    const consent = await setup(70_000);
    const noConsent = await voiceFromDemo(consent.deps, consent.guests, consent.guestId, owner, { consents: [], removeBackgroundNoise: false }).catch((e: unknown) => e);
    expect(noConsent).toMatchObject({ code: "consent_required" });

    const short = await setup(30_000);
    const tooShort = await voiceFromDemo(short.deps, short.guests, short.guestId, owner, { consents: VOICE_CONSENTS, removeBackgroundNoise: false }).catch((e: unknown) => e);
    expect(tooShort).toBeInstanceOf(AccountVoiceError);

    const none = await setup(null);
    const missing = await voiceFromDemo(none.deps, none.guests, none.guestId, owner, { consents: VOICE_CONSENTS, removeBackgroundNoise: false }).catch((e: unknown) => e);
    expect(missing).toMatchObject({ status: 404, code: "no_demo_recording" });
  });
});
