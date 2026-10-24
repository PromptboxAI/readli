import { describe, expect, it } from "vitest";
import { MailerError, MemoryMailer, type Mailer } from "@/lib/invitations/email";
import { emailHash } from "@/lib/invitations/server";
import { fakeEmailDb } from "./fake-db.test-util";
import { deliverySuppressionKey, queueEmails, recordEmailEvent, sendDueEmails, type QueuedEmail } from "./outbox";

const SECRET = "test-secret";
const PARENT = "11111111-1111-4111-8111-111111111111";
// 15:00 UTC is 11:00 in New York: inside send hours.
const NOW = new Date("2026-10-24T15:00:00Z");
const message = { subject: "Hello", html: "<p>Hello</p>", text: "Hello", headers: { "List-Unsubscribe": "<https://readli.ai/x>" } };

function setup(on: string[], extra: Record<string, Record<string, unknown>[]> = {}) {
  const fake = fakeEmailDb({ email_switches: on.map((email_id) => ({ email_id, enabled: true })), ...extra }, { [PARENT]: "parent@example.com" });
  const mailer = new MemoryMailer();
  const run = (m: Mailer = mailer, at = NOW) => sendDueEmails({ db: fake.db, mailer: m, secret: SECRET, now: () => at });
  const queue = (emails: Partial<QueuedEmail>[]) =>
    queueEmails(fake.db, SECRET, emails.map((e, i) => ({ emailId: "F1", dedupeKey: `k${i}`, to: { userId: PARENT }, message, ...e }) as QueuedEmail), NOW);
  return { ...fake, mailer, run, queue };
}

describe("email outbox", () => {
  it("queues each dedupe key once and sends with the row id as the idempotency key", async () => {
    const s = setup(["F1"]);
    await s.queue([{ dedupeKey: "F1:a" }]);
    await s.queue([{ dedupeKey: "F1:a" }]);
    expect(s.tables.email_outbox).toHaveLength(1);
    const report = await s.run();
    expect(report.sent).toBe(1);
    const row = s.tables.email_outbox![0]!;
    expect(s.mailer.sent[0]).toMatchObject({ to: "parent@example.com", subject: "Hello", idempotencyKey: `outbox-${row.id}`, headers: message.headers });
    expect(row.status).toBe("sent");
    expect(await s.run()).toMatchObject({ sent: 0 });
  });

  it("stores a typed-in address encrypted, never in plain text", async () => {
    const s = setup(["G1"]);
    await s.queue([{ emailId: "G1", to: { email: "guest@example.com" } }]);
    expect(JSON.stringify(s.tables.email_outbox)).not.toContain("guest@example.com");
    await s.run();
    expect(s.mailer.sent[0]!.to).toBe("guest@example.com");
  });

  it("cancels an email whose admin switch is off", async () => {
    const s = setup([]);
    await s.queue([{}]);
    expect(await s.run()).toMatchObject({ sent: 0, canceled: 1 });
    expect(s.tables.email_outbox![0]).toMatchObject({ status: "canceled", last_error: "switched_off" });
  });

  it("never emails an address that bounced or complained, even transactional email", async () => {
    const s = setup(["F1"], { email_delivery_suppressions: [{ email_hash: deliverySuppressionKey("Parent@Example.com ") }] });
    await s.queue([{}]);
    expect(await s.run()).toMatchObject({ suppressed: 1, sent: 0 });
  });

  it("sends commercial email only with marketing consent", async () => {
    const s = setup(["BT1"]);
    await s.queue([{ emailId: "BT1", dedupeKey: "BT1:w1" }]);
    expect(await s.run()).toMatchObject({ suppressed: 1 });
    s.tables.email_preferences = [{ user_id: PARENT, marketing: true }];
    await s.queue([{ emailId: "BT1", dedupeKey: "BT1:w2" }]);
    expect(await s.run()).toMatchObject({ sent: 1 });
  });

  it("respects a turned-off topic", async () => {
    const s = setup(["F2"], { email_preferences: [{ user_id: PARENT, setup_reminders: false }] });
    await s.queue([{ emailId: "F2" }]);
    expect(await s.run()).toMatchObject({ suppressed: 1 });
    expect(s.tables.email_outbox![0]!.last_error).toBe("preference_off");
  });

  it("stops invitation reminders after 'Stop all Readli invitations', but not setup emails", async () => {
    const s = setup(["I1", "F2"], { email_suppressions: [{ email_hash: emailHash(SECRET, "parent@example.com"), contributor_id: null, reason: "unsubscribed" }] });
    await s.queue([{ emailId: "I1", dedupeKey: "I1" }]);
    expect(await s.run()).toMatchObject({ suppressed: 1 });
    await s.queue([{ emailId: "F2", dedupeKey: "F2" }]);
    expect(await s.run()).toMatchObject({ sent: 1 });
  });

  it("holds optional email over the daily limit without counting an attempt", async () => {
    const s = setup(["F2", "F4", "F1"], {
      email_outbox: [{ id: "old", dedupe_key: "old", email_id: "F2", category: "relationship", recipient_user_id: PARENT, status: "sent", sent_at: new Date(NOW.getTime() - 3_600_000).toISOString(), attempts: 1 }],
    });
    await s.queue([{ emailId: "F4", dedupeKey: "F4" }, { emailId: "F1", dedupeKey: "F1" }]);
    const report = await s.run();
    expect(report).toMatchObject({ deferred: 1, sent: 1 });
    const f4 = s.tables.email_outbox!.find((r) => r.email_id === "F4")!;
    expect(f4).toMatchObject({ status: "queued", attempts: 0, last_error: "frequency_limit" });
    expect(new Date(f4.next_attempt_at as string).getTime()).toBeGreaterThan(NOW.getTime() + 22 * 3_600_000);
  });

  it("waits for send hours for optional email, but not transactional", async () => {
    const s = setup(["F2", "F1"]);
    await s.queue([{ emailId: "F2", dedupeKey: "F2" }, { emailId: "F1", dedupeKey: "F1" }]);
    // 03:00 UTC is 23:00 in New York.
    const report = await s.run(s.mailer, new Date("2026-10-25T03:00:00Z"));
    expect(report).toMatchObject({ deferred: 1, sent: 1 });
    expect(s.tables.email_outbox!.find((r) => r.email_id === "F2")!.next_attempt_at).toBe("2026-10-25T13:00:00.000Z");
  });

  it("retries when Resend is busy and gives up when it rejects the email", async () => {
    const s = setup(["F1"]);
    await s.queue([{ dedupeKey: "a" }, { dedupeKey: "b" }]);
    let n = 0;
    const flaky: Mailer = {
      send: async () => {
        n += 1;
        throw new MailerError("nope", n === 1 ? 503 : 422);
      },
    };
    expect(await s.run(flaky)).toMatchObject({ failed: 2 });
    const [a, b] = s.tables.email_outbox!;
    expect(a).toMatchObject({ status: "failed", attempts: 1 });
    expect(new Date(a!.next_attempt_at as string).getTime()).toBe(NOW.getTime() + 10 * 60_000);
    expect(b).toMatchObject({ status: "failed", attempts: 6 });
  });
});

describe("Resend webhook events", () => {
  it("store each event once and suppress hard bounces and complaints", async () => {
    const { db, tables } = fakeEmailDb({ email_outbox: [{ id: "e1", provider_ref: "re_1" }] });
    const bounce = { id: "evt_1", type: "email.bounced", data: { email_id: "re_1", to: ["gone@example.com"], bounce: { type: "Permanent" } } };
    expect(await recordEmailEvent(db, bounce)).toEqual({ duplicate: false, suppressed: 1 });
    expect(await recordEmailEvent(db, bounce)).toEqual({ duplicate: true, suppressed: 0 });
    expect(tables.email_delivery_suppressions!.map((r) => r.email_hash)).toEqual([deliverySuppressionKey("gone@example.com")]);
    expect(tables.email_outbox![0]!.last_event).toBe("email.bounced");
    expect(JSON.stringify(tables.email_events)).not.toContain("gone@example.com");
    const soft = { id: "evt_2", type: "email.bounced", data: { email_id: "re_1", to: ["busy@example.com"], bounce: { type: "Transient" } } };
    expect(await recordEmailEvent(db, soft)).toEqual({ duplicate: false, suppressed: 0 });
  });
});
