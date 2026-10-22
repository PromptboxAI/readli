import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ReadyNotice } from "@/lib/family/service";
import { MemoryMailer, type Mailer } from "@/lib/invitations/email";
import { emailStorytellerReady } from "./ready";

type Row = Record<string, unknown>;

/** Enough of the Supabase client for the ready email: filtered select and update, and user lookup. */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let values: Row | null = null;
    const run = () => {
      const hits = (tables[name] ?? []).filter((r) => filters.every((f) => f(r)));
      if (values) for (const r of hits) Object.assign(r, values);
      return { data: hits.map((r) => ({ ...r })), error: null };
    };
    const q = {
      select: () => q,
      limit: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      update: (v: Row) => ((values = v), q),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  const auth = { admin: { getUserById: async (id: string) => ({ data: { user: id === "kevin" ? { email: "kevin@example.com" } : null }, error: null }) } };
  return { from, auth } as unknown as SupabaseClient;
}

const notice: ReadyNotice = {
  name: "Mommy",
  ownName: "Andrea",
  familyName: "the Godfrey Family",
  slotsFull: false,
  title: "Mommy is ready to read!",
  body: "Andrea (Mommy) recorded a voice and shared it with the Godfrey Family. Add them as a storyteller and choose which children can hear them.",
  cta: "Add Mommy to My Family",
  href: "/family/narrators?add=voice-andrea",
};

function world() {
  const tables: Record<string, Row[]> = {
    household_invitations: [{ id: "inv1", household_id: "h1", inviter_id: "kevin", accepted_by: "andrea", ready_notified_at: null }],
    adult_profiles: [{ user_id: "kevin", display_name: "Kevin Godfrey" }],
  };
  return { tables, db: fakeDb(tables) };
}

describe("storyteller ready email", () => {
  it("emails the parent who invited them once, with a link that opens their card", async () => {
    const { tables, db } = world();
    const mailer = new MemoryMailer();
    const input = { householdId: "h1", storytellerId: "andrea", notice };
    expect(await emailStorytellerReady(db, mailer, "https://readli.ai/", input)).toBe("sent");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: "kevin@example.com", subject: "Mommy is ready to read!", idempotencyKey: "storyteller-ready-inv1" });
    expect(mailer.sent[0]!.text).toContain("Hi Kevin,");
    expect(mailer.sent[0]!.text).toContain("Add Mommy to My Family: https://readli.ai/family/narrators?add=voice-andrea");
    expect(tables.household_invitations![0]!.ready_notified_at).not.toBeNull();

    // Stopping and sharing again doesn't email again.
    expect(await emailStorytellerReady(db, mailer, "https://readli.ai", input)).toBe("already_sent");
    expect(mailer.sent).toHaveLength(1);
  });

  it("sends nothing without an invitation or with email off, and lets a failed send try again", async () => {
    const { tables, db } = world();
    expect(await emailStorytellerReady(db, new MemoryMailer(), "https://readli.ai", { householdId: "h2", storytellerId: "andrea", notice })).toBe("no_invitation");
    expect(await emailStorytellerReady(db, null, "https://readli.ai", { householdId: "h1", storytellerId: "andrea", notice })).toBe("off");

    const broken: Mailer = { send: async () => Promise.reject(new Error("resend 500")) };
    expect(await emailStorytellerReady(db, broken, "https://readli.ai", { householdId: "h1", storytellerId: "andrea", notice })).toBe("failed");
    expect(tables.household_invitations![0]!.ready_notified_at).toBeNull();
    expect(await emailStorytellerReady(db, new MemoryMailer(), "https://readli.ai", { householdId: "h1", storytellerId: "andrea", notice })).toBe("sent");
  });
});
