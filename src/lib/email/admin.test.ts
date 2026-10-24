import { describe, expect, it } from "vitest";
import { dashboardState, EmailAdminError, loadEmailDashboard, retryFailedEmail, setEmailSwitch } from "./admin";
import { fakeEmailDb } from "./fake-db.test-util";

const NOW = new Date("2026-10-24T15:00:00Z");
const at = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const row = (id: string, values: Record<string, unknown>) => ({
  id,
  email_id: "F2",
  category: "relationship",
  recipient_user_id: "11111111-1111-4111-8111-111111111111",
  attempts: 1,
  created_at: at(5),
  html: "<a href='https://readli.ai/voice/join?invite=SECRET'>",
  body: "secret body",
  ...values,
});

describe("admin email dashboard", () => {
  it("turns outbox rows and Resend events into the states admins see", () => {
    expect(dashboardState({ status: "queued" })).toBe("scheduled");
    expect(dashboardState({ status: "failed", attempts: 2 })).toBe("scheduled");
    expect(dashboardState({ status: "failed", attempts: 6 })).toBe("failed");
    expect(dashboardState({ status: "sent", last_event: "email.delivered" })).toBe("delivered");
    expect(dashboardState({ status: "sent", last_event: "email.bounced" })).toBe("bounced");
    expect(dashboardState({ status: "sent", last_event: null })).toBe("sent");
    expect(dashboardState({ status: "suppressed" })).toBe("suppressed");
  });

  it("counts per email and lists recent sends without bodies, links or addresses", async () => {
    const { db } = fakeEmailDb({
      email_switches: [{ email_id: "F2", enabled: true }],
      email_outbox: [
        row("a", { status: "sent", last_event: "email.delivered", sent_at: at(4) }),
        row("b", { status: "failed", attempts: 6, last_error: "422 invalid" }),
        row("c", { status: "suppressed", last_error: "preference_off", email_id: "F4" }),
        row("old", { status: "sent", created_at: at(24 * 40) }),
      ],
    });
    const dash = await loadEmailDashboard(db, { now: NOW });
    expect(dash.totals).toMatchObject({ delivered: 1, failed: 1, suppressed: 1, sent: 0 });
    const f2 = dash.emails.find((e) => e.id === "F2")!;
    expect(f2).toMatchObject({ enabled: true, counts: expect.objectContaining({ delivered: 1, failed: 1 }) });
    expect(dash.emails.find((e) => e.id === "F4")!.enabled).toBe(false);
    expect(dash.recent.map((r) => [r.id, r.canRetry])).toEqual([
      ["a", false],
      ["b", true],
      ["c", false],
    ]);
    expect(JSON.stringify(dash)).not.toMatch(/SECRET|secret body|11111111-1111-4111/);
    expect(dash.recent[0]!.recipient).toBe("account 11111111");

    const failedOnly = await loadEmailDashboard(db, { now: NOW, state: "failed" });
    expect(failedOnly.recent.map((r) => r.id)).toEqual(["b"]);
  });

  it("retries only failed emails", async () => {
    const { db, tables } = fakeEmailDb({ email_outbox: [row("b", { status: "failed", attempts: 6 }), row("s", { status: "sent" }), row("x", { status: "suppressed" })] });
    await retryFailedEmail(db, "b", NOW);
    expect(tables.email_outbox![0]).toMatchObject({ status: "queued", attempts: 0, next_attempt_at: NOW.toISOString(), last_error: null });
    await expect(retryFailedEmail(db, "s", NOW)).rejects.toBeInstanceOf(EmailAdminError);
    await expect(retryFailedEmail(db, "x", NOW)).rejects.toBeInstanceOf(EmailAdminError);
    expect(tables.email_outbox![1]!.status).toBe("sent");
  });

  it("switches only emails in the matrix, recording who changed it", async () => {
    const { db, tables } = fakeEmailDb();
    await setEmailSwitch(db, "admin-1", "BT1", true, NOW);
    await setEmailSwitch(db, "admin-1", "BT1", false, NOW);
    expect(tables.email_switches).toEqual([expect.objectContaining({ email_id: "BT1", enabled: false, updated_by: "admin-1" })]);
    await expect(setEmailSwitch(db, "admin-1", "ZZ9", true)).rejects.toBeInstanceOf(EmailAdminError);
  });
});
