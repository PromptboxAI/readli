import { describe, expect, it } from "vitest";
import { ACCESSIBILITY_INTRO, ACCESSIBILITY_SECTIONS } from "./accessibility";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "./privacy-policy";
import { TERMS_INTRO, TERMS_SECTIONS } from "./terms";
import { VOICE_AGREEMENT_INTRO, VOICE_AGREEMENT_SECTIONS } from "./voice-agreement";
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
