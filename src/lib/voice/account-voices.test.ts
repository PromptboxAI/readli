import { describe, expect, it } from "vitest";
import { REQUIRED_AGREEMENT_STATEMENTS } from "@/lib/content/voice-agreement";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { acceptVoiceAgreement, MemoryVoiceAgreementStore, setThirdPartyLicensing } from "./agreements";
import { VoiceProviderError } from "./provider";
import { StubVoiceProvider } from "./stub";
import { AccountVoiceError, accountVoiceSample, consentPurposes, createAccountVoice, expectedTranscript, MemoryAccountVoiceStore, type TakeUpload } from "./account-voices";

const limits = { minRecordingMs: 59_000, maxRecordingMs: 150_000, maxRecordingBytes: 25 * 1024 * 1024 };
const owner = { id: "11111111-2222-3333-4444-555555555555", name: "Grandma June" };

let agreementId: string | null = null;

function take(over: Partial<TakeUpload> = {}): TakeUpload {
  // ~24 KB/s, like a real 192 kbps take, so the server's silence check passes.
  return {
    audio: new Blob([new Uint8Array(70 * 24_000)], { type: "audio/webm" }),
    durationMs: 70_000,
    wpm: 140,
    pauseCount: 0,
    deviceClass: "phone",
    scriptOffsetEnd: 900,
    agreementId: agreementId,
    removeBackgroundNoise: false,
    qc: { speechMs: 60_000, issues: [] },
    userAgent: "test",
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

const contributor = { id: owner.id, name: owner.name, email: "june@example.com" };

async function setup(thirdPartyLicensing = false) {
  const store = new MemoryAccountVoiceStore();
  const agreements = new MemoryVoiceAgreementStore();
  const provider = new RecordingProvider();
  agreementId = (await acceptVoiceAgreement(agreements, contributor, { statements: REQUIRED_AGREEMENT_STATEMENTS, thirdPartyLicensing, userAgent: null })).id;
  return { store, agreements, provider, deps: { store, agreements, provider, limits } };
}

describe("account voices", () => {
  it("saves the take and consent, clones with the speaker's noise choice and saves a ready voice", async () => {
    const { store, provider, deps } = await setup();
    const voice = await createAccountVoice(deps, owner, take());
    expect(voice.status).toBe("ready");
    expect(provider.created).toEqual([{ removeBackgroundNoise: false }]);
    expect(store.takes).toHaveLength(1);
    expect(store.receipts[0]).toMatchObject({ ownerId: owner.id, agreementId, removeBackgroundNoise: false });
    expect(store.takes[0]).toMatchObject({ agreementId, language: "en", transcript: expectedTranscript(900) });
    expect(await store.providerVoiceId(voice.id)).toBe("stub-voice-1");
  });

  it("refuses without an agreement in force, and refuses takes under a minute", async () => {
    const { store, deps } = await setup();
    const noConsent = await createAccountVoice(deps, owner, take({ agreementId: null })).catch((e: unknown) => e);
    expect(noConsent).toBeInstanceOf(AccountVoiceError);
    expect((noConsent as AccountVoiceError).code).toBe("consent_required");
    const someoneElses = await createAccountVoice(deps, { id: "other", name: "Someone" }, take()).catch((e: unknown) => e);
    expect((someoneElses as AccountVoiceError).code).toBe("consent_required");
    const short = await createAccountVoice(deps, owner, take({ durationMs: 30_000 })).catch((e: unknown) => e);
    expect((short as AccountVoiceError).code).toBe("too_short");
    expect(store.takes).toHaveLength(0);
  });

  it("recording again keeps the same voice and removes the old provider voice", async () => {
    const { store, provider, deps } = await setup();
    const first = await createAccountVoice(deps, owner, take());
    const second = await createAccountVoice(deps, owner, take({ removeBackgroundNoise: true }));
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(2);
    expect(await store.providerVoiceId(first.id)).toBe("stub-voice-2");
    expect(provider.deleted).toEqual(["stub-voice-1"]);
  });

  it("hides provider errors and keeps the old voice when a clone fails", async () => {
    const { store, deps } = await setup();
    const first = await createAccountVoice(deps, owner, take());
    const failing = { ...deps, provider: Object.assign(new StubVoiceProvider(), { createInstantVoice: async () => { throw new VoiceProviderError("quota 401", 401); } }) };
    const err = await createAccountVoice(failing, owner, take()).catch((e: unknown) => e);
    expect((err as AccountVoiceError).code).toBe("clone_failed");
    expect((err as AccountVoiceError).userMessage).not.toMatch(/quota|401/);
    expect(await store.providerVoiceId(first.id)).toBe("stub-voice-1");
  });

  it("plays a sample only once the owner has a voice", async () => {
    const { deps } = await setup();
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

describe("voice recording agreement", () => {
  it("needs every required line before recording, and licensing to others starts off", async () => {
    const agreements = new MemoryVoiceAgreementStore();
    await expect(acceptVoiceAgreement(agreements, contributor, { statements: REQUIRED_AGREEMENT_STATEMENTS.slice(1), thirdPartyLicensing: false, userAgent: null })).rejects.toMatchObject({ code: "agreement_required" });
    const a = await acceptVoiceAgreement(agreements, contributor, { statements: REQUIRED_AGREEMENT_STATEMENTS, thirdPartyLicensing: false, userAgent: null });
    expect(a.rights).toEqual({ service: true, readliDevelopment: true, thirdPartyLicensing: false });
    expect(agreements.rows[0]).toMatchObject({ contributorEmail: "june@example.com", source: "pre_recording", adultOwnerDeclared: true });
    expect(consentPurposes(a)).toEqual(["create", "narrate_for_shared_families", "readli_development"]);
  });

  it("keeps every licensing change as history, and the latest row is in force", async () => {
    const agreements = new MemoryVoiceAgreementStore();
    const first = await acceptVoiceAgreement(agreements, contributor, { statements: REQUIRED_AGREEMENT_STATEMENTS, thirdPartyLicensing: true, userAgent: null });
    const off = await setThirdPartyLicensing(agreements, contributor, false, null);
    expect(off.rights.thirdPartyLicensing).toBe(false);
    expect(agreements.rows[1]).toMatchObject({ event: "updated", source: "settings", supersedesId: first.id });
    const history = await agreements.history(contributor.id);
    expect(history.map((h) => h.rights.thirdPartyLicensing)).toEqual([false, true]);
  });

  it("can't turn licensing on before agreeing to record", async () => {
    await expect(setThirdPartyLicensing(new MemoryVoiceAgreementStore(), contributor, true, null)).rejects.toMatchObject({ code: "no_agreement" });
  });

  it("a recording made after a licensing change uses the newest agreement", async () => {
    const { deps, agreements } = await setup(true);
    const updated = await setThirdPartyLicensing(agreements, contributor, false, null);
    const stale = await createAccountVoice(deps, owner, take()).catch((e: unknown) => e);
    expect((stale as AccountVoiceError).code).toBe("consent_required");
    agreementId = updated.id;
    expect((await createAccountVoice(deps, owner, take())).status).toBe("ready");
  });
});
