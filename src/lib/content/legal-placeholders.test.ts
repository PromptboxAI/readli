import { describe, expect, it } from "vitest";
import { ACCESSIBILITY_INTRO, ACCESSIBILITY_SECTIONS } from "./accessibility";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "./privacy-policy";
import { TERMS_INTRO, TERMS_SECTIONS } from "./terms";
import { VOICE_AGREEMENT_INTRO, VOICE_AGREEMENT_SECTIONS, VOICE_CHOICES } from "./voice-agreement";
import type { PolicySection } from "./privacy-policy";

const pages: Record<string, [string[], PolicySection[]]> = {
  privacy: [PRIVACY_INTRO, PRIVACY_SECTIONS],
  terms: [TERMS_INTRO, TERMS_SECTIONS],
  "voice agreement": [VOICE_AGREEMENT_INTRO, VOICE_AGREEMENT_SECTIONS],
  accessibility: [ACCESSIBILITY_INTRO, ACCESSIBILITY_SECTIONS],
};

describe("published legal pages (Kevin, 2026-10-12: unconfirmed markers stay in the internal audit)", () => {
  for (const [name, [intro, sections]] of Object.entries(pages)) {
    it(`${name} has no bracketed placeholders or TO BE CONFIRMED markers`, () => {
      const text = [...intro, ...sections.flatMap((s) => [s.title, ...s.paragraphs.map((p) => `${p.lead ?? ""} ${p.text}`)])].join("\n");
      expect(text).not.toMatch(/TO BE CONFIRMED/i);
      expect(text).not.toMatch(/\[[A-Z][A-Z0-9 .,'’-]{3,}\]/);
    });
  }
});

describe("voice choice notices (Kevin, 2026-10-21)", () => {
  it("never say a clone or recording is already gone before the provider deletion has finished", () => {
    for (const notice of [VOICE_CHOICES.deleteRecordings.notice, VOICE_CHOICES.stopSharing.notice]) {
      expect(notice).not.toMatch(/retired now|is retired|are deleted|were deleted|has been deleted/i);
    }
  });

  it("separate stopping new stories, queuing recording deletion and the voice provider copy", () => {
    expect(VOICE_CHOICES.stopSharing.notice).toMatch(/no family can have new stories/i);
    expect(VOICE_CHOICES.stopSharing.notice).toMatch(/stays stored at our voice provider/i);
    expect(VOICE_CHOICES.deleteRecordings.notice).toMatch(/request to delete them from our storage is recorded/i);
  });
});
