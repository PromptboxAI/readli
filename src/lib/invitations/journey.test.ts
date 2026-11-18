// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyFamilyState } from "@/lib/family/account-store";
import type { FamilyState } from "@/lib/family/model";
import { invitationUnfinished } from "./journey";

/** Two households (A and B) with a child each; the storyteller June has voice v1 shared with both. */
function families(): FamilyState {
  const s = emptyFamilyState();
  s.voices.push({ id: "v1", ownerId: "june", deletedAt: null } as never);
  s.children.push({ id: "kid-a", householdId: "A", deletedAt: null } as never, { id: "kid-b", householdId: "B", deletedAt: null } as never);
  return s;
}
const approve = (s: FamilyState, voiceId: string, childId: string, revokedAt: string | null = null) => s.approvals.push({ voiceId, childId, revokedAt } as never);
const inv = (status: "pending" | "opened" | "accepted" | "expired" | "declined" | "revoked", householdId: string | null) => ({ status, householdId, contributorId: "june" });

describe("invitationUnfinished: Continue adding [Name] on Family home", () => {
  it("offers to continue until the storyteller is connected", () => {
    expect(invitationUnfinished(families(), inv("pending", null), "A")).toBe(true);
    expect(invitationUnfinished(families(), inv("opened", null), "A")).toBe(true);
  });

  it("keeps offering after connecting, until a child in this family can listen", () => {
    const s = families();
    expect(invitationUnfinished(s, inv("accepted", "A"), "A")).toBe(true);
    approve(s, "v1", "kid-a");
    expect(invitationUnfinished(s, inv("accepted", "A"), "A")).toBe(false);
  });

  it("keeps two households apart: B's approval doesn't finish A's invitation", () => {
    const s = families();
    approve(s, "v1", "kid-b");
    expect(invitationUnfinished(s, inv("accepted", "A"), "A")).toBe(true);
    // And an invitation accepted by A never shows as B's next step.
    expect(invitationUnfinished(s, inv("accepted", "A"), "B")).toBe(false);
  });

  it("drops expired, declined and withdrawn invitations", () => {
    for (const status of ["expired", "declined", "revoked"] as const) expect(invitationUnfinished(families(), inv(status, null), "A")).toBe(false);
  });

  it("follows a replaced voice: approvals on the deleted voice don't count, the new voice's do", () => {
    const s = families();
    approve(s, "v1", "kid-a");
    (s.voices[0] as { deletedAt: string | null }).deletedAt = "2026-10-20T00:00:00Z";
    s.voices.push({ id: "v2", ownerId: "june", deletedAt: null } as never);
    expect(invitationUnfinished(s, inv("accepted", "A"), "A")).toBe(true);
    approve(s, "v2", "kid-a");
    expect(invitationUnfinished(s, inv("accepted", "A"), "A")).toBe(false);
  });

  it("ignores revoked approvals", () => {
    const s = families();
    approve(s, "v1", "kid-a", "2026-10-21T00:00:00Z");
    expect(invitationUnfinished(s, inv("accepted", "A"), "A")).toBe(true);
  });
});
