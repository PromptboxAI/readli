import { describe, expect, it } from "vitest";
import { acceptInvite, INVITE_TTL_DAYS, inviteMessage, type FamilyInvite } from "./family-invites";

const NOW = new Date("2026-10-10T12:00:00Z");
const invite: FamilyInvite = { id: "i1", name: "Grandpa Lou", relationship: "Grandpa", email: null, status: "invited", createdAt: NOW };

describe("family invitations", () => {
  it("only adds a circle membership: no voice, no child approval, no subscription", () => {
    const r = acceptInvite(invite, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invite.status).toBe("joined_no_voice");
    expect(r.voiceGrants).toEqual([]);
    expect(r.childApprovals).toEqual([]);
    expect(r.subscription).toBeNull();
  });

  it("expires unopened invitations", () => {
    const later = new Date(NOW.getTime() + (INVITE_TTL_DAYS + 1) * 86_400_000);
    expect(acceptInvite(invite, later)).toEqual({ ok: false, reason: "expired" });
    expect(acceptInvite({ ...invite, status: "revoked" }, NOW)).toEqual({ ok: false, reason: "not_pending" });
  });

  it("says the voice stays theirs", () => {
    const msg = inviteMessage({ from: "Sara", to: "Grandpa Lou", relationship: "Grandpa" });
    expect(msg).toContain("Hi Grandpa Lou!");
    expect(msg).toContain("private until you choose to share it");
  });
});
