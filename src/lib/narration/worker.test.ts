import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { MemoryFamilyStore, type FamilyStore } from "@/lib/family/service";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import { narrationFor, requestGeneration } from "./narration";
import { bookText } from "./text";
import { prepareEveryFamily } from "./worker";

const mom: Actor = { kind: "adult", adultId: "sara" };
const H = DEMO_HOUSEHOLD_ID;
const SLUG = "the-lion-and-the-mouse";

class Provider implements VoiceProvider {
  calls = 0;
  async createInstantVoice() {
    return { voiceId: "x" };
  }
  async synthesize(): Promise<SynthesizedAudio> {
    this.calls += 1;
    return { audio: toneWav(1), contentType: "audio/wav", standIn: true };
  }
  async deleteVoice() {}
}

describe("background preparation", () => {
  it("finishes a family's queued preparation with nobody's page open", async () => {
    const state = demoFamilyState();
    const store = new MemoryFamilyStore(state, DEFAULT_PLAN);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: SLUG, scope: "book" });
    expect(job?.status).toBe("queued");
    const provider = new Provider();
    const result = await prepareEveryFamily([{ householdId: H, userId: "sara" }], () => store, provider, 60_000);
    expect(result).toEqual({ households: 1, failed: [] });
    expect(state.jobs.find((j) => j.id === job!.id)?.status).toBe("done");
    expect(narrationFor(state, store.plan, "voice-june", bookText(SLUG)!, H).status.readiness).toBe("ready");
    expect(provider.calls).toBe(job!.sentenceIds.length);
  });

  it("one family's failure doesn't stop the others", async () => {
    const state = demoFamilyState();
    const store = new MemoryFamilyStore(state, DEFAULT_PLAN);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: SLUG, scope: "book" });
    const broken = { read: async () => Promise.reject(new Error("db down")) } as unknown as FamilyStore;
    const result = await prepareEveryFamily(
      [
        { householdId: "other", userId: "someone" },
        { householdId: H, userId: "sara" },
      ],
      (user) => (user === "someone" ? broken : store),
      new Provider(),
      60_000,
    );
    expect(result).toEqual({ households: 1, failed: ["other"] });
    expect(state.jobs.find((j) => j.id === job!.id)?.status).toBe("done");
  });
});
