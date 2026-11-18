import { describe, expect, it } from "vitest";
import { cleanFamilyName, familyNameCookie, familyNameFor, startHref, startStep, startStepAfter, startStepBefore } from "./start";

describe("startStep", () => {
  it("starts someone new on their name, then picks up where they left off", () => {
    expect(startStep(undefined, { familyNamed: false, voice: false })).toBe("name");
    expect(startStep(undefined, { familyNamed: true, voice: false })).toBe("voice");
    expect(startStep(undefined, { familyNamed: true, voice: true })).toBe("listen");
  });

  it("shows the screen asked for, and ignores anything else", () => {
    expect(startStep("family", { familyNamed: true, voice: true })).toBe("family");
    expect(startStep("nope", { familyNamed: false, voice: false })).toBe("name");
  });
});

describe("start steps", () => {
  it("runs name, family, voice, listen, then the plan page", () => {
    expect(startStepAfter("name")).toBe("family");
    expect(startStepAfter("listen")).toBe("plan");
    expect(startStepAfter("plan")).toBeNull();
    expect(startStepBefore("name")).toBeNull();
    expect(startStepBefore("plan")).toBe("listen");
    expect(startHref("voice")).toBe("/start?step=voice");
    expect(startHref("plan")).toBe("/start/plan");
  });
});

describe("cleanFamilyName", () => {
  it("trims, keeps one line and caps the length", () => {
    expect(cleanFamilyName("  The   Godfrey\nFamily ")).toBe("The Godfrey Family");
    expect(cleanFamilyName("x".repeat(80))).toHaveLength(60);
    expect(cleanFamilyName("   ")).toBeNull();
    expect(cleanFamilyName(null)).toBeNull();
  });
});

describe("familyNameFor", () => {
  it("reads back the name only for the account that typed it", () => {
    const raw = familyNameCookie("user-a", "The Godfrey Family");
    expect(familyNameFor(raw, "user-a")).toBe("The Godfrey Family");
    expect(familyNameFor(raw, "user-b")).toBeNull();
  });

  it("ignores an empty cookie and one from before names were tied to an account", () => {
    expect(familyNameFor(undefined, "user-a")).toBeNull();
    expect(familyNameFor(encodeURIComponent("The Godfreys"), "user-a")).toBeNull();
  });
});
