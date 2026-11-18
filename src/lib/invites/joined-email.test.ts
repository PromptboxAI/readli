import { describe, expect, it } from "vitest";
import { fakeEmailDb } from "@/lib/email/fake-db.test-util";
import { queueInviterJoinedEmail } from "./joined-email";
import { hashInviteToken } from "./server";

const PARENT = "11111111-1111-4111-8111-111111111111";
const JO = "22222222-2222-4222-8222-222222222222";
const TOKEN = "tok";

function setup(values: Record<string, unknown> = {}) {
  return fakeEmailDb({
    household_invitations: [
      { id: "inv1", household_id: "h1", inviter_id: PARENT, invitee_name: "Jo", invitee_role: "guardian", accepted_by: JO, token_hash: hashInviteToken(TOKEN), ...values },
    ],
    adult_profiles: [
      { user_id: PARENT, display_name: "Sam Rivera" },
      { user_id: JO, display_name: "Jordan" },
    ],
    households: [{ id: "h1", name: "The Riveras" }],
  });
}

const ctx = (db: ReturnType<typeof setup>["db"]) => ({ db, secret: "s", base: "https://readli.test" });

describe("queueInviterJoinedEmail", () => {
  it("emails whoever invited a new parent, without calling them a partner", async () => {
    const { db, tables } = setup();
    const ids = await queueInviterJoinedEmail(ctx(db), TOKEN, JO);
    expect(ids).toHaveLength(1);
    const [row] = tables.email_outbox!;
    expect(row).toMatchObject({ email_id: "I4", dedupe_key: "I4:inv1", recipient_user_id: PARENT, category: "transactional", subject: "Jordan joined your family on Readli" });
    expect(row!.body).toContain("Hi Sam,");
    expect(row!.body).toContain("Jordan joined The Riveras on Readli");
    expect(row!.body).toContain("https://readli.test/family/settings/parents");
    expect(String(row!.body)).not.toMatch(/partner|co-parent/i);
  });

  it("sends once per invitation", async () => {
    const { db, tables } = setup();
    await queueInviterJoinedEmail(ctx(db), TOKEN, JO);
    expect(await queueInviterJoinedEmail(ctx(db), TOKEN, JO)).toEqual([]);
    expect(tables.email_outbox).toHaveLength(1);
  });

  it("leaves storyteller invitations alone", async () => {
    const { db, tables } = setup({ invitee_role: "member" });
    expect(await queueInviterJoinedEmail(ctx(db), TOKEN, JO)).toEqual([]);
    expect(tables.email_outbox ?? []).toHaveLength(0);
  });

  it("falls back to the invited name when the new parent has no profile name", async () => {
    const { db, tables } = setup();
    tables.adult_profiles = tables.adult_profiles!.filter((p) => p.user_id !== JO);
    await queueInviterJoinedEmail(ctx(db), TOKEN, JO);
    expect(tables.email_outbox![0]!.subject).toBe("Jo joined your family on Readli");
  });
});
