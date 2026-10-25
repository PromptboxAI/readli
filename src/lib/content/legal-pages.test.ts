import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "./privacy-policy";
import { TERMS_INTRO, TERMS_SECTIONS } from "./terms";

const text = (intro: string[], sections: { title: string; paragraphs: { lead?: string; text: string }[] }[]) =>
  [...intro, ...sections.flatMap((s) => [s.title, ...s.paragraphs.flatMap((p) => [p.lead ?? "", p.text])])].join("\n");
const terms = text(TERMS_INTRO, TERMS_SECTIONS);
const privacy = text(PRIVACY_INTRO, PRIVACY_SECTIONS);

describe("published legal pages (Kevin, 2026-10-23)", () => {
  it("have no draft placeholders or review notes", () => {
    for (const doc of [terms, privacy]) {
      expect(doc).not.toMatch(/\[[A-Z][A-Z -]*\]/);
      expect(doc).not.toMatch(/TO BE CONFIRMED|COUNSEL REVIEW|DRAFT|will be documented before launch/i);
    }
  });

  it("render without the Draft badge", () => {
    for (const page of ["terms", "privacy"]) {
      expect(readFileSync(join(__dirname, `../../app/${page}/page.tsx`), "utf8")).not.toMatch(/draftNote/);
    }
  });

  it("say what the live service does with voices", () => {
    // No AI training or third-party licensing without separate permission.
    expect(terms).toMatch(/does not use your recordings or your voice model to train/);
    expect(privacy).toMatch(/does not use voice recordings, voice models, or children’s information to train/);
    // The demo period matches the homepage and the hourly clean-up.
    expect(privacy).toMatch(/within 24 hours of recording/);
    expect(terms).toMatch(/within 24 hours of recording/);
    // In-app voice deletion is paused, and both pages say how to ask instead.
    expect(terms).toMatch(/temporarily unavailable/);
    expect(privacy).toMatch(/temporarily unavailable/);
  });

  it("say where the Meta Pixel runs and how to turn it off (Kevin, 2026-10-25)", () => {
    expect(privacy).toMatch(/Meta Pixel/);
    expect(privacy).toMatch(/never runs in Readli Kids/);
    expect(privacy).toMatch(/do not use third-party advertising or tracking in Readli Kids/);
    expect(privacy).toMatch(/Global Privacy Control/);
    expect(privacy).not.toMatch(/does not use third-party analytics or advertising trackers/);
  });
});
