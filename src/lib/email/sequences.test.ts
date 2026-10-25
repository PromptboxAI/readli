import { describe, expect, it } from "vitest";
import { EMAILS } from "./catalog";
import { fakeEmailDb } from "./fake-db.test-util";
import { scheduleSequenceEmails } from "./sequences";
import { signupIntent } from "./signup";

const NOW = new Date("2026-10-24T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const PARENT = "11111111-1111-4111-8111-111111111111";
const GRANDMA = "22222222-2222-4222-8222-222222222222";
const ALL = new Set(EMAILS.map((e) => e.id));

function world(tables: Record<string, Record<string, unknown>[]>) {
  const fake = fakeEmailDb({ adult_profiles: [{ user_id: PARENT, display_name: "Dana Smith" }, { user_id: GRANDMA, display_name: "Rose" }], ...tables });
  const run = (enabled = ALL, now = NOW) => scheduleSequenceEmails({ db: fake.db, secret: "s", base: "https://readli.ai", now, enabled });
  const queued = () => (fake.tables.email_outbox ?? []).map((r) => r.dedupe_key as string).sort();
  return { ...fake, run, queued };
}

const household = (createdDaysAgo: number) => ({
  households: [{ id: "h1", name: "The Smiths", created_by: PARENT, created_at: daysAgo(createdDaysAgo) }],
  household_members: [{ household_id: "h1", user_id: PARENT, role: "guardian", removed_at: null }],
});

describe("Family onboarding", () => {
  it("welcomes the grown-up who created the household, once", async () => {
    const w = world(household(0.1));
    expect(await w.run()).toMatchObject({ queued: 1, errors: [] });
    expect(w.queued()).toEqual(["F1:h1"]);
    const row = w.tables.email_outbox![0]!;
    expect(row).toMatchObject({ email_id: "F1", category: "transactional", recipient_user_id: PARENT, household_id: "h1" });
    expect(row.body).toContain("Hi Dana,");
    expect(row.body).toContain("https://readli.ai/family");
    await w.run();
    expect(w.queued()).toEqual(["F1:h1"]);
  });

  it("looks only for emails switched on", async () => {
    const w = world(household(0.1));
    await w.run(new Set(["F2"]));
    expect(w.queued()).toEqual([]);
  });

  it("nudges each setup step only until it's done, with an unsubscribe header", async () => {
    const w = world(household(6));
    await w.run();
    expect(w.queued()).toEqual(["F2:h1", "F4:h1", "F5:h1"]);
    const f2 = w.tables.email_outbox!.find((r) => r.email_id === "F2")!;
    expect(f2.category).toBe("relationship");
    expect((f2.headers as Record<string, string>)["List-Unsubscribe"]).toContain("topic=setup_reminders");
    expect(f2.body).toContain("https://readli.ai/family/my-voice");

    const done = world({
      ...household(6),
      voice_profiles: [{ id: "v1", owner_id: PARENT, status: "processing", deleted_at: null }],
      household_invitations: [{ household_id: "h1" }],
      kids_devices: [{ household_id: "h1" }],
    });
    await done.run();
    expect(done.queued()).toEqual([]);
  });

  it("waits for each step's day and stops after day 10", async () => {
    const day2 = world(household(2));
    await day2.run();
    expect(day2.queued()).toEqual(["F2:h1"]);
    const day11 = world(household(11));
    await day11.run();
    expect(day11.queued()).toEqual([]);
  });

  it("doesn't count a household whose creator no longer looks after it", async () => {
    const w = world({ ...household(0.1), household_members: [{ household_id: "h1", user_id: PARENT, role: "guardian", removed_at: daysAgo(0) }] });
    await w.run();
    expect(w.queued()).toEqual([]);
  });
});

describe("voice ready", () => {
  it("sends F3 to a family owner and C3 to a contributor", async () => {
    const w = world({
      household_members: [{ household_id: "h1", user_id: PARENT, role: "guardian", removed_at: null }],
      voice_profiles: [
        { id: "vp", owner_id: PARENT, status: "ready", deleted_at: null, updated_at: daysAgo(0.1) },
        { id: "vg", owner_id: GRANDMA, status: "ready", deleted_at: null, updated_at: daysAgo(0.1) },
        { id: "old", owner_id: GRANDMA, status: "ready", deleted_at: null, updated_at: daysAgo(5) },
      ],
    });
    await w.run();
    expect(w.queued()).toEqual(["C3:vg", "F3:vp"]);
  });
});

describe("Readli Voice contributor onboarding", () => {
  const signup = (intent: string, d: number) => ({ email_signups: [{ user_id: GRANDMA, intent, created_at: daysAgo(d) }] });

  it("welcomes voice signups, not family signups, after half an hour", async () => {
    const w = world(signup("voice_invited", 0.1));
    await w.run();
    expect(w.queued()).toEqual(["C1:22222222-2222-4222-8222-222222222222"]);
    expect(w.tables.email_outbox![0]!.body).toContain("https://readli.ai/voice/record");
    const fam = world(signup("family", 0.1));
    await fam.run();
    expect(fam.queued()).toEqual([]);
    const fresh = world({ email_signups: [{ user_id: GRANDMA, intent: "voice", created_at: new Date(NOW.getTime() - 10 * 60_000).toISOString() }] });
    await fresh.run();
    expect(fresh.queued()).toEqual([]);
  });

  it("nudges recording, then sharing for self-started contributors only", async () => {
    const noVoice = world(signup("voice", 3));
    await noVoice.run();
    expect(noVoice.queued()).toEqual(["C2:22222222-2222-4222-8222-222222222222"]);

    const ready = { voice_profiles: [{ id: "vg", owner_id: GRANDMA, status: "ready", deleted_at: null, updated_at: daysAgo(4) }] };
    const self = world({ ...signup("voice", 5), ...ready });
    await self.run();
    expect(self.queued()).toEqual(["C4:22222222-2222-4222-8222-222222222222"]);
    const invited = world({ ...signup("voice_invited", 5), ...ready });
    await invited.run();
    expect(invited.queued()).toEqual([]);
    const sharing = world({ ...signup("voice", 5), ...ready, voice_household_shares: [{ voice_id: "vg", revoked_at: null }] });
    await sharing.run();
    expect(sharing.queued()).toEqual([]);
  });

  it("never sends Readli Voice email to someone who now runs a household", async () => {
    const w = world({ ...signup("voice", 3), household_members: [{ household_id: "h9", user_id: GRANDMA, role: "guardian", removed_at: null }] });
    await w.run();
    expect(w.queued()).toEqual([]);
  });

  it("never mentions plans, trials, prices or subscriptions", async () => {
    const w = world({
      email_signups: [{ user_id: GRANDMA, intent: "voice", created_at: daysAgo(0.5) }],
      voice_profiles: [{ id: "vg", owner_id: GRANDMA, status: "ready", deleted_at: null, updated_at: daysAgo(0.1) }],
    });
    await w.run();
    const later = world({ email_signups: [{ user_id: GRANDMA, intent: "voice", created_at: daysAgo(5) }], voice_profiles: [{ id: "vg", owner_id: GRANDMA, status: "ready", deleted_at: null, updated_at: daysAgo(4) }] });
    await later.run();
    const noVoice = world({ email_signups: [{ user_id: GRANDMA, intent: "voice", created_at: daysAgo(3) }] });
    await noVoice.run();
    const rows = [...w.tables.email_outbox!, ...later.tables.email_outbox!, ...noVoice.tables.email_outbox!];
    expect(rows.map((r) => r.email_id).sort()).toEqual(["C1", "C2", "C3", "C4"]);
    for (const r of rows) expect(`${r.subject} ${r.body} ${r.html}`).not.toMatch(/\b(plan|plans|trial|price|prices|pricing|subscri\w*|billing|\$\d)/i);
  });
});

describe("signup intent", () => {
  it("tells signups apart by where sign-in was headed", () => {
    expect(signupIntent("/voice/join?invite=abc")).toBe("voice_invited");
    expect(signupIntent("/voice/record?from=try")).toBe("voice");
    expect(signupIntent("/family?start=1")).toBe("family");
    expect(signupIntent("/books")).toBeNull();
  });
});
