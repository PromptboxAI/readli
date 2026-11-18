import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import { bookText } from "@/lib/narration/text";
import { changeEmail, supportPlaces } from "./support-people";
import { AdminActionError } from "./tester-plans";

const admin = { id: "admin-1", email: "admin@readli.ai", name: "Admin" };
/** A database that fails the test if it's ever asked anything. */
const untouched = new Proxy({}, { get: () => { throw new Error("database used"); } }) as unknown as SupabaseClient;

describe("support: people", () => {
  it("lists each kid's reading places, newest first, with the narrator the family calls them by", () => {
    const state = demoFamilyState();
    const lion = bookText("the-lion-and-the-mouse")!;
    state.progress.push(
      { childId: "maya", bookSlug: lion.slug, sentence: 4, voiceId: "voice-june", updatedAt: "2026-11-01T00:00:00Z", listenedAt: "2026-11-01T00:00:00Z" },
      { childId: "leo", bookSlug: lion.slug, sentence: 0, voiceId: null, updatedAt: "2026-11-02T00:00:00Z" },
    );
    const places = supportPlaces(state, DEMO_HOUSEHOLD_ID);
    expect(places.map((p) => p.kid)).toEqual(["Leo", "Maya"]);
    expect(places[1]).toMatchObject({ book: lion.title, sentence: 5, of: lion.sentences.length, narrator: "Grandma June" });
    expect(places[0]!.narrator).toBeNull();
  });

  it("checks a new sign-in email before touching the account", async () => {
    for (const [email, again, message] of [
      ["not-an-email", "not-an-email", /Enter the new email/],
      ["new@example.com", "other@example.com", /don't match/],
    ] as const) {
      const err = await changeEmail(untouched, admin, "user-1", email, again).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AdminActionError);
      expect((err as Error).message).toMatch(message);
    }
  });
});
