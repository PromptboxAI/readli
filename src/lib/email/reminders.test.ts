import { describe, expect, it } from "vitest";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { fakeEmailDb } from "./fake-db.test-util";
import { queueInvitationReminders, recordReminderDeliveries } from "./reminders";
import { scheduleSequenceEmails } from "./sequences";

const SECRET = "s";
// 15:00 UTC is 11:00 in New York: inside send hours.
const NOW = new Date("2026-10-24T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();
const PARENT = "11111111-1111-4111-8111-111111111111";
const ROSE = "22222222-2222-4222-8222-222222222222";
const enc = (e: string) => new ProviderRefCipher(SECRET).encrypt(e);

const invite = (values: Record<string, unknown> = {}) => ({
  id: "inv1",
  household_id: "h1",
  inviter_id: PARENT,
  invitee_name: "Rose",
  recipient_email_encrypted: enc("rose@example.com"),
  created_at: daysAgo(4),
  last_sent_at: daysAgo(4),
  expires_at: daysAhead(10),
  accepted_at: null,
  revoked_at: null,
  declined_at: null,
  reported_at: null,
  ...values,
});

function world(tables: Record<string, Record<string, unknown>[]>, rpcResult = "sent") {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const fake = fakeEmailDb(
    { adult_profiles: [{ user_id: PARENT, display_name: "Dana" }], households: [{ id: "h1", name: "The Smiths" }], voice_invitation_settings: [{ id: true, link_days: 14 }], ...tables },
    {},
    (name, args) => (calls.push({ name, args }), rpcResult),
  );
  const ctx = (enabled = new Set(["I1", "I2", "I3"]), now = NOW) => ({ db: fake.db, secret: SECRET, base: "https://readli.ai", now, enabled });
  return { ...fake, calls, ctx };
}

describe("invitation reminders", () => {
  it("send a fresh link through the Resend function, counted toward its limits", async () => {
    const w = world({ household_invitations: [invite()] });
    const sent = await queueInvitationReminders(w.ctx());
    expect(sent).toHaveLength(1);
    expect(w.calls).toEqual([{ name: "send_household_invitation", args: expect.objectContaining({ p_inviter: PARENT, p_invitation: "inv1" }) }]);
    const row = w.tables.email_outbox![0]!;
    expect(row).toMatchObject({ email_id: "I1", dedupe_key: "I1:inv1:1", category: "relationship" });
    expect(row.subject).toBe("Dana is still saving a spot for your voice");
    expect(row.body).toContain("A quick reminder: this invitation is still open.");
    expect(row.body).toContain("https://readli.ai/voice/join?invite=");
    expect(JSON.stringify(row)).not.toContain("rose@example.com");
    expect((row.headers as Record<string, string>)["List-Unsubscribe"]).toContain("/api/invitations/unsubscribe/");
  });

  it("never remind an expired, nearly expired, closed or too-recent invitation", async () => {
    for (const values of [
      { expires_at: daysAgo(1) },
      { expires_at: daysAhead(1) },
      { accepted_at: daysAgo(1) },
      { declined_at: daysAgo(1) },
      { revoked_at: daysAgo(1) },
      { reported_at: daysAgo(1) },
      { last_sent_at: daysAgo(1) },
      { recipient_email_encrypted: null },
    ]) {
      const w = world({ household_invitations: [invite(values)] });
      expect(await queueInvitationReminders(w.ctx())).toEqual([]);
      expect(w.calls).toEqual([]);
    }
  });

  it("send nothing when the database refuses (limit reached, unsubscribed, sending off)", async () => {
    const w = world({ household_invitations: [invite()] }, "resend_limit");
    expect(await queueInvitationReminders(w.ctx())).toEqual([]);
    expect(w.tables.email_outbox ?? []).toEqual([]);
  });

  it("send the second reminder only from day 7, and never a third", async () => {
    const w = world({ household_invitations: [invite({ created_at: daysAgo(5), last_sent_at: daysAgo(4) })] });
    await queueInvitationReminders(w.ctx());
    w.tables.household_invitations![0]!.last_sent_at = daysAgo(3);
    expect(await queueInvitationReminders(w.ctx())).toEqual([]);
    w.tables.household_invitations![0]!.created_at = daysAgo(8);
    expect((await queueInvitationReminders(w.ctx())).map((r) => r.dedupeKey)).toEqual(["I1:inv1:2"]);
    w.tables.household_invitations![0]!.created_at = daysAgo(12);
    expect(await queueInvitationReminders(w.ctx())).toEqual([]);
  });

  it("only make new links inside send hours, and only when switched on", async () => {
    const w = world({ household_invitations: [invite()] });
    expect(await queueInvitationReminders(w.ctx(new Set(["I1"]), new Date("2026-10-25T03:00:00Z")))).toEqual([]);
    expect(await queueInvitationReminders(w.ctx(new Set(["I3"])))).toEqual([]);
    expect(w.calls).toEqual([]);
  });

  it("remind a family about a storyteller's voice invitation with a fresh preview link", async () => {
    const w = world(
      {
        adult_profiles: [{ user_id: ROSE, display_name: "Rose" }],
        voice_invitations: [{ ...invite(), contributor_id: ROSE, preview_id: null, recipient_name: "Sam", message: "" }],
      },
      "resent",
    );
    await queueInvitationReminders(w.ctx());
    expect(w.calls[0]).toMatchObject({ name: "resend_voice_invitation", args: { p_contributor: ROSE, p_invitation: "inv1" } });
    const row = w.tables.email_outbox![0]!;
    expect(row).toMatchObject({ email_id: "I2", subject: "Still waiting: Rose has a bedtime story for your family" });
    expect(row.body).toContain("https://readli.ai/v/");
  });

  it("mark the recorded send as sent once the email goes", async () => {
    const w = world({ household_invitations: [invite()], household_invitation_sends: [{ id: 7, invitation_id: "inv1", delivery: "queued" }] });
    const sent = await queueInvitationReminders(w.ctx());
    Object.assign(w.tables.email_outbox![0]!, { status: "sent", provider_ref: "re_9" });
    await recordReminderDeliveries(w.db, sent);
    expect(w.tables.household_invitation_sends![0]).toMatchObject({ delivery: "sent", provider_message_id: "re_9" });
  });
});

describe("storyteller heads-up", () => {
  it("tells the parent when a storyteller joined 10 to 14 days ago and hasn't recorded", async () => {
    const accepted = { ...invite({ accepted_at: daysAgo(11), accepted_by: ROSE }) };
    const w = world({ household_invitations: [accepted], household_members: [{ household_id: "h1", user_id: ROSE, removed_at: null }], adult_profiles: [{ user_id: PARENT, display_name: "Dana" }, { user_id: ROSE, display_name: "Rose" }] });
    await scheduleSequenceEmails(w.ctx(new Set(["I3"])));
    const row = w.tables.email_outbox![0]!;
    expect(row).toMatchObject({ email_id: "I3", recipient_user_id: PARENT, subject: "Rose hasn't recorded yet" });
    expect(row.body).toContain("https://readli.ai/family/narrators");

    const recorded = world({ household_invitations: [accepted], household_members: [{ household_id: "h1", user_id: ROSE, removed_at: null }], voice_profiles: [{ owner_id: ROSE, status: "ready", deleted_at: null }] });
    await scheduleSequenceEmails(recorded.ctx(new Set(["I3"])));
    expect(recorded.tables.email_outbox ?? []).toEqual([]);
  });
});
