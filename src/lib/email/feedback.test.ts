import { describe, expect, it } from "vitest";
import { fakeEmailDb } from "./fake-db.test-util";
import { FeedbackError, feedbackRequests, feedbackToken, fromFeedbackToken, queueFeedbackEmails, saveFeedback, winBack } from "./feedback";

const NOW = new Date("2026-10-24T15:00:00Z");
const PARENT = "11111111-1111-4111-8111-111111111111";
const HOME = "22222222-2222-4222-8222-222222222222";
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function setup(sessions: { started: number; seen: number }[], enabled: string[], extra: Record<string, Record<string, unknown>[]> = {}) {
  const fake = fakeEmailDb({
    households: [{ id: HOME, created_by: PARENT }],
    household_members: [{ household_id: HOME, user_id: PARENT, role: "guardian", removed_at: null }],
    adult_profiles: [{ user_id: PARENT, display_name: "Sam Lee" }],
    household_entitlements: [{ household_id: HOME, status: "active", ends_at: null }],
    listening_sessions: sessions.map((s, i) => ({ id: `ls${i}`, household_id: HOME, child_id: "kid", started_at: daysAgo(s.started), last_seen_at: daysAgo(s.seen) })),
    ...extra,
  });
  return { fake, ctx: { db: fake.db, secret: "s", base: "https://readli.test", now: NOW, enabled: new Set(enabled) } };
}

describe("FB1", () => {
  it("asks 21 days after the first story, the same for everyone, with a signed link", async () => {
    const { ctx } = setup([{ started: 22, seen: 2 }], ["FB1"]);
    const [email] = await feedbackRequests(ctx);
    expect(email!.dedupeKey).toBe(`FB1:${HOME}`);
    expect(email!.message.text).toContain("/feedback?t=");
    expect(email!.message.headers!["List-Unsubscribe"]).toContain("topic=feedback_requests");
    expect(email!.message.text).not.toMatch(/listened|minutes|stories this week/i);
  });

  it("waits for day 21, ignores households that started earlier, and asks at most every 180 days", async () => {
    expect(await feedbackRequests(setup([{ started: 10, seen: 1 }], ["FB1"]).ctx)).toEqual([]);
    expect(await feedbackRequests(setup([{ started: 60, seen: 50 }, { started: 22, seen: 1 }], ["FB1"]).ctx)).toEqual([]);
    const asked = { email_outbox: [{ email_id: "FB1", recipient_user_id: PARENT, created_at: daysAgo(100), dedupe_key: "FB1:old" }] };
    expect(await feedbackRequests(setup([{ started: 22, seen: 1 }], ["FB1"], asked).ctx)).toEqual([]);
  });
});

describe("feedback answers", () => {
  it("checks the link and saves any score, high or low", async () => {
    const token = feedbackToken("s", PARENT, HOME, "FB1");
    const who = fromFeedbackToken("s", token)!;
    expect(who).toEqual({ userId: PARENT, householdId: HOME, ask: "FB1" });
    expect(fromFeedbackToken("other", token)).toBeNull();
    expect(fromFeedbackToken("s", token.replace("FB1", "W2"))).toBeNull();
    const { fake } = setup([], []);
    await saveFeedback(fake.db, who, { score: 2, comment: " too pricey " });
    await saveFeedback(fake.db, who, { score: 10 });
    expect(fake.tables.feedback_responses!.map((r) => [r.score, r.comment])).toEqual([
      [2, "too pricey"],
      [10, null],
    ]);
    await expect(saveFeedback(fake.db, who, { score: 11 })).rejects.toThrow(FeedbackError);
  });

  it("takes a reason for W2", async () => {
    const { fake } = setup([], []);
    await saveFeedback(fake.db, { userId: PARENT, householdId: HOME, ask: "W2" }, { reason: "busy", score: 9 });
    expect(fake.tables.feedback_responses![0]).toMatchObject({ reason: "busy", score: null });
  });
});

describe("win-back", () => {
  it("sends W1 after two quiet weeks and W2 after four, as marketing email", async () => {
    const w1 = await winBack(setup([{ started: 40, seen: 15 }], ["W1", "W2"]).ctx);
    expect(w1.map((e) => e.emailId)).toEqual(["W1"]);
    expect(w1[0]!.message.headers!["List-Unsubscribe"]).toContain("topic=marketing");
    expect(w1[0]!.message.text).toContain("/family/books");
    const w2 = await winBack(setup([{ started: 40, seen: 29 }], ["W1", "W2"]).ctx);
    expect(w2.map((e) => e.emailId)).toEqual(["W2"]);
    expect(w2[0]!.message.text).toContain("/feedback?t=");
  });

  it("skips families still listening, with no plan, or switched off", async () => {
    expect(await winBack(setup([{ started: 40, seen: 15 }, { started: 2, seen: 1 }], ["W1"]).ctx)).toEqual([]);
    expect(await winBack(setup([{ started: 40, seen: 15 }], ["W1"], { household_entitlements: [] }).ctx)).toEqual([]);
    expect(await queueFeedbackEmails(setup([{ started: 40, seen: 15 }], []).ctx)).toEqual({ queued: 0, errors: [] });
  });
});
