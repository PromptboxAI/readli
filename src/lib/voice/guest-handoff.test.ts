import { describe, expect, it } from "vitest";
import { VOICE_CONSENTS } from "@/lib/content/voice-consents";
import { MemoryGuestStore } from "@/lib/server/guest-store";
import { AccountVoiceError, keepVoiceCandidate, MemoryAccountVoiceStore } from "./account-voices";
import { createVoiceCandidateFromGuest, findGuestTake } from "./guest-handoff";
import { StubVoiceProvider } from "./stub";

const limits = { minRecordingMs: 59_000, maxRecordingMs: 150_000, maxRecordingBytes: 25 * 1024 * 1024 };
const owner = { id: "11111111-2222-3333-4444-555555555555", name: "Grandma June" };

async function guestWithTake() {
  const guests = new MemoryGuestStore();
  const guest = await guests.createSession({ tokenHash: "h", policyVersion: "v1", generationsAllowed: 4 });
  // ~24 KB/s, like a real take, so the server's silence check passes.
  const audio = new Blob([new Uint8Array(70 * 24_000)], { type: "audio/webm;codecs=opus" });
  await guests.saveRecording(guest.id, audio, { durationMs: 70_000, mimeType: audio.type, teleprompterWpm: 140, pauseCount: 1, deviceClass: "phone", scriptOffsetEnd: 900 });
  return { guests, guest };
}

describe("voice from the /try take", () => {
  it("offers the latest guest take with when it will be deleted", async () => {
    const { guests, guest } = await guestWithTake();
    expect(await findGuestTake(guests, guest)).toEqual({ durationMs: 70_000, expiresAt: guest.expiresAt });
    expect(await findGuestTake(guests, null)).toBeNull();
  });

  it("makes a candidate from the saved take without recording again, under the account's own consent", async () => {
    const { guests, guest } = await guestWithTake();
    const store = new MemoryAccountVoiceStore();
    const deps = { store, provider: new StubVoiceProvider(), limits };
    const candidate = await createVoiceCandidateFromGuest(deps, guests, guest, owner, { consents: VOICE_CONSENTS, removeBackgroundNoise: true });
    expect(candidate).toMatchObject({ durationMs: 70_000, wpm: 140, pauseCount: 1, deviceClass: "phone", removeBackgroundNoise: true, mimeType: "audio/webm" });
    expect(store.receipts[0]).toMatchObject({ ownerId: owner.id, statements: VOICE_CONSENTS });
    const voice = await keepVoiceCandidate(deps, owner);
    expect(voice.status).toBe("ready");
  });

  it("still needs every account consent, and says so when the guest take is gone", async () => {
    const { guests, guest } = await guestWithTake();
    const deps = { store: new MemoryAccountVoiceStore(), provider: new StubVoiceProvider(), limits };
    const noConsent = await createVoiceCandidateFromGuest(deps, guests, guest, owner, { consents: [], removeBackgroundNoise: false }).catch((e: unknown) => e);
    expect((noConsent as AccountVoiceError).code).toBe("consent_required");

    await guests.deleteSession(guest.id);
    const gone = await createVoiceCandidateFromGuest(deps, guests, null, owner, { consents: VOICE_CONSENTS, removeBackgroundNoise: false }).catch((e: unknown) => e);
    expect(gone).toBeInstanceOf(AccountVoiceError);
    expect((gone as AccountVoiceError).status).toBe(410);
  });
});
