import { describe, expect, it } from "vitest";
import { VOICE_CONSENTS } from "@/lib/content/voice-consents";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { VoiceProviderError } from "./provider";
import { StubVoiceProvider } from "./stub";
import { AccountVoiceError, accountVoiceSample, createAccountVoice, MemoryAccountVoiceStore, type TakeUpload } from "./account-voices";

const limits = { minRecordingMs: 59_000, maxRecordingMs: 150_000, maxRecordingBytes: 25 * 1024 * 1024 };
const owner = { id: "11111111-2222-3333-4444-555555555555", name: "Grandma June" };

function take(over: Partial<TakeUpload> = {}): TakeUpload {
  // ~24 KB/s, like a real 192 kbps take, so the server's silence check passes.
  return {
    audio: new Blob([new Uint8Array(70 * 24_000)], { type: "audio/webm" }),
    durationMs: 70_000,
    wpm: 140,
    pauseCount: 0,
    deviceClass: "phone",
    scriptOffsetEnd: 900,
    consents: VOICE_CONSENTS,
    removeBackgroundNoise: false,
    ...over,
  };
}

class RecordingProvider extends StubVoiceProvider {
  readonly created: { removeBackgroundNoise?: boolean }[] = [];
  override async createInstantVoice(input?: { removeBackgroundNoise?: boolean }) {
    this.created.push({ removeBackgroundNoise: input?.removeBackgroundNoise });
    return super.createInstantVoice();
  }
}

function setup() {
  const store = new MemoryAccountVoiceStore();
  const provider = new RecordingProvider();
  return { store, provider, deps: { store, provider, limits } };
}

describe("account voices", () => {
  it("saves the take and consent, clones with the speaker's noise choice and saves a ready voice", async () => {
    const { store, provider, deps } = setup();
    const voice = await createAccountVoice(deps, owner, take());
    expect(voice.status).toBe("ready");
    expect(provider.created).toEqual([{ removeBackgroundNoise: false }]);
    expect(store.takes).toHaveLength(1);
    expect(store.receipts[0]).toMatchObject({ ownerId: owner.id, statements: VOICE_CONSENTS, removeBackgroundNoise: false });
    expect(await store.providerVoiceId(voice.id)).toBe("stub-voice-1");
  });

  it("refuses without every consent, and refuses takes under a minute", async () => {
    const { store, deps } = setup();
    const noConsent = await createAccountVoice(deps, owner, take({ consents: VOICE_CONSENTS.slice(1) })).catch((e: unknown) => e);
    expect(noConsent).toBeInstanceOf(AccountVoiceError);
    expect((noConsent as AccountVoiceError).code).toBe("consent_required");
    const short = await createAccountVoice(deps, owner, take({ durationMs: 30_000 })).catch((e: unknown) => e);
    expect((short as AccountVoiceError).code).toBe("too_short");
    expect(store.takes).toHaveLength(0);
  });

  it("recording again keeps the same voice and removes the old provider voice", async () => {
    const { store, provider, deps } = setup();
    const first = await createAccountVoice(deps, owner, take());
    const second = await createAccountVoice(deps, owner, take({ removeBackgroundNoise: true }));
    expect(second.id).toBe(first.id);
    expect(store.voices.get(first.id)?.version).toBe(2);
    expect(await store.providerVoiceId(first.id)).toBe("stub-voice-2");
    expect(provider.deleted).toEqual(["stub-voice-1"]);
  });

  it("hides provider errors and keeps the old voice when a clone fails", async () => {
    const { store, deps } = setup();
    const first = await createAccountVoice(deps, owner, take());
    const failing = { ...deps, provider: Object.assign(new StubVoiceProvider(), { createInstantVoice: async () => { throw new VoiceProviderError("quota 401", 401); } }) };
    const err = await createAccountVoice(failing, owner, take()).catch((e: unknown) => e);
    expect((err as AccountVoiceError).code).toBe("clone_failed");
    expect((err as AccountVoiceError).userMessage).not.toMatch(/quota|401/);
    expect(await store.providerVoiceId(first.id)).toBe("stub-voice-1");
  });

  it("plays a sample only once the owner has a voice", async () => {
    const { deps } = setup();
    expect(((await accountVoiceSample(deps, owner.id).catch((e: unknown) => e)) as AccountVoiceError).code).toBe("no_voice");
    await createAccountVoice(deps, owner, take());
    expect((await accountVoiceSample(deps, owner.id)).standIn).toBe(true);
  });

  it("stores provider ids encrypted", () => {
    const cipher = new ProviderRefCipher("secret");
    const stored = cipher.encrypt("voice-abc");
    expect(stored).not.toContain("voice-abc");
    expect(cipher.decrypt(stored)).toBe("voice-abc");
  });
});
