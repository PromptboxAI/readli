import { describe, expect, it } from "vitest";
import { NO_PROGRESS, showVoiceHomeSteps, voiceHomeSteps, type VoiceHomeFacts } from "./home-progress";

const facts = (over: Partial<VoiceHomeFacts> = {}): VoiceHomeFacts => ({ recorded: true, heard: false, sent: false, gave: false, gifting: true, ...over });

describe("voiceHomeSteps", () => {
  it("lists record, hear, send and gift in order, with a button only on what's left", () => {
    const steps = voiceHomeSteps(facts());
    expect(steps.map((s) => s.id)).toEqual(["record", "hear", "send", "gift"]);
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false]);
    expect(steps[0]!.action).toBeNull();
    expect(steps.slice(1).map((s) => s.action?.href)).toEqual(["#stories", "/voice/invite", "/gift/family"]);
  });

  it("leaves out the gift while gifts aren't on sale, unless they already gave one", () => {
    expect(voiceHomeSteps(facts({ gifting: false })).map((s) => s.id)).toEqual(["record", "hear", "send"]);
    expect(voiceHomeSteps(facts({ gifting: false, gave: true })).map((s) => s.id)).toContain("gift");
  });
});

describe("showVoiceHomeSteps", () => {
  it("shows until every step is done or the list is hidden", () => {
    expect(showVoiceHomeSteps(voiceHomeSteps(facts()), NO_PROGRESS)).toBe(true);
    expect(showVoiceHomeSteps(voiceHomeSteps(facts({ heard: true, sent: true, gave: true })), NO_PROGRESS)).toBe(false);
    expect(showVoiceHomeSteps(voiceHomeSteps(facts()), { ...NO_PROGRESS, hiddenAt: "2026-11-12T00:00:00.000Z" })).toBe(false);
  });
});
