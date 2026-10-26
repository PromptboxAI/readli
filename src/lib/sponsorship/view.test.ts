import { describe, expect, it } from "vitest";
import { fakeEmailDb } from "@/lib/email/fake-db.test-util";
import { hashInvitationToken } from "@/lib/invitations/server";
import { householdGift, invitationLanding, placeState, sponsorGifts } from "./view";

const NOW = new Date("2027-01-10T00:00:00.000Z");
const TOKEN = "a".repeat(32);

function world() {
  return fakeEmailDb({
    sponsorships: [
      {
        id: "sp-1",
        sponsor_id: "ruth",
        plan: "annual",
        status: "active",
        price_cents: 17999,
        giver_display_name: "Grandma Ruth",
        message: "Love, Grandma",
        created_at: "2026-11-28T15:00:00.000Z",
        deliver_at: "2026-12-25T12:00:00.000Z",
        delivered_at: "2026-12-25T12:02:00.000Z",
        starts_at: "2026-12-25T12:00:00.000Z",
        paid_through: "2027-12-25T12:00:00.000Z",
        ends_at: null,
      },
    ],
    sponsorship_seats: [
      { id: "seat-1", sponsorship_id: "sp-1", seat: 1, status: "active", recipient_name: "Michael and Sarah", share_voice: true, household_id: "home-m", accepted_at: "2026-12-25T15:00:00.000Z", credit_share: 20, created_at: "2026-11-28T15:00:00.000Z" },
      { id: "seat-2", sponsorship_id: "sp-1", seat: 2, status: "invited", recipient_name: "Emma and David", share_voice: true, household_id: null, credit_share: 20, created_at: "2026-11-28T15:00:00.000Z" },
    ],
    sponsorship_invitations: [
      { id: "inv-1", seat_id: "seat-1", token_hash: "x", opened_at: "2026-12-25T13:00:00.000Z", accepted_at: "2026-12-25T15:00:00.000Z", revoked_at: null, expires_at: "2027-02-23T00:00:00.000Z" },
      { id: "inv-2", seat_id: "seat-2", token_hash: hashInvitationToken(TOKEN), opened_at: null, accepted_at: null, revoked_at: null, expires_at: "2027-02-23T00:00:00.000Z" },
    ],
    voice_profiles: [{ id: "voice-ruth", owner_id: "ruth", deleted_at: null }],
    voice_household_shares: [{ voice_id: "voice-ruth", household_id: "home-m", revoked_at: null }],
    child_profiles: [{ id: "lily", household_id: "home-m", deleted_at: null }],
    child_voice_approvals: [{ voice_id: "voice-ruth", child_id: "lily", revoked_at: null }],
    household_entitlements: [{ id: "plan-m", household_id: "home-m", source: "sponsored", sponsorship_id: "sp-1", starts_at: "2026-12-25T12:00:00.000Z" }],
    narration_credit_ledger: [
      { household_id: "home-m", kind: "commit", lot_id: "subscription:plan-m:2026-12-25", credits: 12000 },
      { household_id: "home-m", kind: "commit", lot_id: "purchased:pack-1", credits: 5000 },
    ],
  });
}

describe("what the sponsor sees", () => {
  it("labels each place without anything about the children", () => {
    expect(placeState({ status: "invited" }, false, false)).toBe("arrives");
    expect(placeState({ status: "invited" }, true, true)).toBe("opened");
    expect(placeState({ status: "active" }, true, true)).toBe("joined");
    expect(placeState({ status: "removed" }, true, true)).toBe("ended");
  });

  it("shows joined, voice approved, and gift credits used as a number", async () => {
    const { db } = world();
    const [gift] = await sponsorGifts(db, "ruth", NOW);
    expect(gift).toMatchObject({ plan: "annual", status: "active", nextMonthFrom: "2027-01-25T12:00:00.000Z", freePlaces: [], canChangeFamilies: true });
    expect(gift!.places).toEqual([
      expect.objectContaining({ seat: 1, name: "Michael and Sarah", state: "joined", voice: "approved", creditShare: 20, usedThisMonth: 12 }),
      expect.objectContaining({ seat: 2, name: "Emma and David", state: "invited", voice: "not_shared", usedThisMonth: 0 }),
    ]);
    // Nothing about children, books or other storytellers is in what the sponsor gets.
    expect(JSON.stringify(gift)).not.toMatch(/lily|plan-m|purchased/);
  });

  it("shows nobody else's gifts", async () => {
    const { db } = world();
    expect(await sponsorGifts(db, "someone-else", NOW)).toEqual([]);
  });
});

describe("the family's side", () => {
  it("opens the gift link once, and only for a delivered gift", async () => {
    const { db, tables } = world();
    const landing = await invitationLanding(db, TOKEN, NOW);
    expect(landing).toMatchObject({ status: "ready", giverName: "Grandma Ruth", recipientName: "Emma and David", sharesVoice: true, creditShare: 20, endsAt: "2027-12-25T12:00:00.000Z" });
    expect(tables.sponsorship_invitations![1]!.opened_at).toBe(NOW.toISOString());
    expect(tables.analytics_events!.map((e) => e.name)).toEqual(["sponsor_invitation_opened"]);
    await invitationLanding(db, TOKEN, NOW);
    expect(tables.analytics_events).toHaveLength(1);
    expect(await invitationLanding(db, "b".repeat(32), NOW)).toBeNull();
  });

  it("an expired or withdrawn link says so", async () => {
    const { db, tables } = world();
    expect((await invitationLanding(db, TOKEN, new Date("2027-03-01T00:00:00.000Z")))?.status).toBe("expired");
    tables.sponsorship_seats![1]!.status = "canceled";
    expect((await invitationLanding(db, TOKEN, NOW))?.status).toBe("invalid");
  });

  it("gives the parents their own gift details", async () => {
    const { db } = world();
    expect(await householdGift(db, "home-m")).toMatchObject({ giverName: "Grandma Ruth", plan: "annual", endsAt: "2027-12-25T12:00:00.000Z", creditShare: 20 });
    expect(await householdGift(db, "home-x")).toBeNull();
  });
});
