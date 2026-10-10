import { describe, expect, it } from "vitest";
import { canCreateVoice, canJoinContributorHousehold, signupPath, signupStart, upgradeToFamily, type OwnedVoice } from "./accounts";

const NOW = "2026-10-10T12:00:00Z";

describe("Readli Voice contributors", () => {
  it("get one verified voice each; a second adult in the household has their own", () => {
    const grandma = { id: "g", email: "g@x", displayName: "Grandma", verifiedAt: NOW };
    const voices: OwnedVoice[] = [];
    expect(canCreateVoice({ ...grandma, verifiedAt: null }, voices).ok).toBe(false);
    expect(canCreateVoice(grandma, voices).ok).toBe(true);
    voices.push({ id: "v", ownerId: "g", deletedAt: null });
    expect(canCreateVoice(grandma, voices).ok).toBe(false);
    expect(canCreateVoice({ ...grandma, id: "p" }, voices).ok).toBe(true);
    expect(canJoinContributorHousehold(1)).toBe(true);
    expect(canJoinContributorHousehold(2)).toBe(false);
  });

  it("keep their identity and household when they upgrade to Readli Family", () => {
    expect(upgradeToFamily({ id: "home-g", kind: "contributor" })).toEqual({ id: "home-g", kind: "family" });
  });
});

describe("signup routing", () => {
  it("has two entry points and sends invitations to Readli Voice without a second identity", () => {
    expect(signupPath(signupStart({ signedIn: false }))).toBe("/signup");
    expect(signupPath(signupStart({ signedIn: false, choice: "family" }))).toBe("/signup/family");
    expect(signupPath(signupStart({ signedIn: false, choice: "kids" }))).toBe("/signup");
    expect(signupPath(signupStart({ signedIn: false, invitation: "tok" }))).toBe("/signup/voice?invite=tok");
    expect(signupPath(signupStart({ signedIn: true, invitation: "tok" }))).toBe("/voice?invite=tok");
  });
});
