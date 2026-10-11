// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { queueEmails, recordEmailEvent, sendDueEmails } from "./outbox";
import { emailConfig, suppressionKey, type EmailSender, type SendResult } from "./resend";

const config = { ...emailConfig({ RESEND_API_KEY: "k", EMAIL_FROM: "hello@readli.ai" } as unknown as NodeJS.ProcessEnv), spacingMs: 0 };
const NOW = new Date("2026-12-01T06:00:00Z");

function sender(results: SendResult[]) {
  const sent: { to: string; key: string }[] = [];
  const s: EmailSender = {
    send: async (email, key) => {
      sent.push({ to: email.to, key });
      return results.shift() ?? { ok: true, id: `em_${sent.length}` };
    },
  };
  return { s, sent };
}

const message = { template: "family_invite" as const, subject: "Hi", body: "Join us" };

describe("the email outbox", () => {
  it("queues each message once and sends it once, with the row id as the idempotency key", async () => {
    const { db, tables } = fakeSupabase({}, { users: { sara: { email: "sara@example.com" } } });
    const first = await queueEmails(db, [{ dedupeKey: "invite:1", ...message, to: { userId: "sara" }, sendAfter: NOW.toISOString() }]);
    const again = await queueEmails(db, [{ dedupeKey: "invite:1", ...message, to: { userId: "sara" }, sendAfter: NOW.toISOString() }]);
    expect(first).toHaveLength(1);
    expect(again).toEqual([]);
    const { s, sent } = sender([]);
    expect(await sendDueEmails({ db, sender: s, config, now: () => NOW })).toMatchObject({ sent: 1 });
    expect(await sendDueEmails({ db, sender: s, config, now: () => NOW })).toMatchObject({ sent: 0 });
    expect(sent).toEqual([{ to: "sara@example.com", key: `outbox-${first[0]}` }]);
    expect(tables.email_outbox![0]).toMatchObject({ status: "sent", provider_ref: "em_1" });
  });

  it("retries later when Resend is busy, and gives up on a rejected address", async () => {
    const { db, tables } = fakeSupabase();
    await queueEmails(db, [
      { dedupeKey: "a", ...message, to: { email: "a@example.com" }, sendAfter: NOW.toISOString() },
      { dedupeKey: "b", ...message, to: { email: "b@example.com" }, sendAfter: NOW.toISOString() },
    ]);
    const { s } = sender([
      { ok: false, retry: true, error: "429" },
      { ok: false, retry: false, error: "422 invalid" },
    ]);
    expect(await sendDueEmails({ db, sender: s, config, now: () => NOW })).toMatchObject({ failed: 2 });
    const [a, b] = tables.email_outbox!;
    expect(a).toMatchObject({ status: "failed", attempts: 1, next_attempt_at: new Date(NOW.getTime() + 10 * 60_000).toISOString() });
    expect(b).toMatchObject({ status: "failed", attempts: 6 });
    // Not due yet; then due, and it goes.
    expect(await sendDueEmails({ db, sender: s, config, now: () => NOW })).toMatchObject({ sent: 0 });
    expect(await sendDueEmails({ db, sender: s, config, now: () => new Date(NOW.getTime() + 11 * 60_000) })).toMatchObject({ sent: 1 });
  });

  it("never emails an address that bounced or complained", async () => {
    const { db, tables } = fakeSupabase();
    expect(await recordEmailEvent(db, { id: "msg_1", type: "email.bounced", data: { email_id: "em_9", to: ["Gone@Example.com"], bounce: { type: "Permanent" } } })).toEqual({ duplicate: false, suppressed: 1 });
    expect(await recordEmailEvent(db, { id: "msg_1", type: "email.bounced", data: { email_id: "em_9", to: ["Gone@Example.com"] } })).toEqual({ duplicate: true, suppressed: 0 });
    expect(await recordEmailEvent(db, { id: "msg_2", type: "email.bounced", data: { to: ["soft@example.com"], bounce: { type: "Transient" } } })).toEqual({ duplicate: false, suppressed: 0 });
    expect(tables.email_suppressions).toEqual([expect.objectContaining({ email_key: suppressionKey("gone@example.com"), reason: "bounce" })]);
    await queueEmails(db, [{ dedupeKey: "x", ...message, to: { email: "gone@example.com" }, sendAfter: NOW.toISOString() }]);
    const { s, sent } = sender([]);
    expect(await sendDueEmails({ db, sender: s, config, now: () => NOW })).toMatchObject({ suppressed: 1 });
    expect(sent).toEqual([]);
  });

  it("sends at most a batch per run", async () => {
    const { db } = fakeSupabase();
    await queueEmails(db, Array.from({ length: 5 }, (_, i) => ({ dedupeKey: `k${i}`, ...message, to: { email: `p${i}@example.com` }, sendAfter: NOW.toISOString() })));
    const { s } = sender([]);
    expect(await sendDueEmails({ db, sender: s, config: { ...config, batchSize: 2 }, now: () => NOW })).toMatchObject({ sent: 2 });
  });
});
