// @vitest-environment node
import { describe, expect, it } from "vitest";
import { REQUIRED_AGREEMENT_STATEMENTS } from "@/lib/content/voice-agreement";
import { MemoryGuestStore } from "@/lib/server/guest-store";
import { AccountVoiceError, MemoryAccountVoiceStore } from "./account-voices";
import { acceptVoiceAgreement, MemoryVoiceAgreementStore } from "./agreements";
import { voiceFromDemo } from "./demo-voice";
import { StubVoiceProvider } from "./stub";

const limits = { minRecordingMs: 59_000, maxRecordingMs: 150_000, maxRecordingBytes: 25 * 1024 * 1024 };
const owner = { id: "11111111-2222-3333-4444-555555555555", name: "Sara" };
const meta = (durationMs: number) => ({ durationMs, mimeType: "audio/webm", teleprompterWpm: 140, pauseCount: 0, deviceClass: "phone" as const, scriptOffsetEnd: 900 });

async function setup(durationMs: number | null, agree = true) {
  const guests = new MemoryGuestStore();
  const guest = await guests.createSession({ tokenHash: `t${Math.random()}`, policyVersion: "v" });
  // ~24 KB/s, like a real take, so the server's silence check passes.
  if (durationMs !== null) await guests.saveRecording(guest.id, new Blob([new Uint8Array((durationMs / 1000) * 24_000)], { type: "audio/webm" }), meta(durationMs));
  const store = new MemoryAccountVoiceStore();
  const agreements = new MemoryVoiceAgreementStore();
  const agreementId = agree
    ? (await acceptVoiceAgreement(agreements, { ...owner, email: "sara@example.com", jurisdiction: "US-NY" }, { statements: REQUIRED_AGREEMENT_STATEMENTS, thirdPartyLicensing: true, userAgent: null })).id
    : null;
  const input = { agreementId, removeBackgroundNoise: false, userAgent: null };
  return { guests, guestId: guest.id, store, input, deps: { store, agreements, provider: new StubVoiceProvider(), limits } };
}

describe("voice from the demo", () => {
  it("turns the demo take into the grown-up's voice once they accept the agreement, never for training", async () => {
    const { guests, guestId, store, deps, input } = await setup(70_000);
    const voice = await voiceFromDemo(deps, guests, guestId, owner, input);
    expect(voice.status).toBe("ready");
    expect(await store.findVoice(owner.id)).toMatchObject({ id: voice.id });
    // Recorded before the agreement, so it never counts as training data, even with licensing switched on.
    expect(store.takes[0]).toMatchObject({ origin: "guest_demo", excludedFromTraining: true });
  });

  it("still needs the agreement, a real minute, and a take that hasn't been deleted", async () => {
    const unagreed = await setup(70_000, false);
    const noAgreement = await voiceFromDemo(unagreed.deps, unagreed.guests, unagreed.guestId, owner, unagreed.input).catch((e: unknown) => e);
    expect(noAgreement).toMatchObject({ code: "consent_required" });

    const short = await setup(30_000);
    const tooShort = await voiceFromDemo(short.deps, short.guests, short.guestId, owner, short.input).catch((e: unknown) => e);
    expect(tooShort).toBeInstanceOf(AccountVoiceError);

    const none = await setup(null);
    const missing = await voiceFromDemo(none.deps, none.guests, none.guestId, owner, none.input).catch((e: unknown) => e);
    expect(missing).toMatchObject({ status: 404, code: "no_demo_recording" });
  });
});
