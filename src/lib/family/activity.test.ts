import { describe, expect, it } from "vitest";
import { bookText } from "@/lib/narration/text";
import { familyInbox, familyTimeline, noticeAction, timelineLine, unreadCount } from "./activity";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import type { FamilyState } from "./model";

const SLUG = "the-lion-and-the-mouse";

function withReadyBook(state: FamilyState, slug = SLUG, voiceId = "voice-sara"): FamilyState {
  const text = bookText(slug)!;
  const key = `lib-${slug}-${voiceId}`;
  state.libraries.push({ key, voiceId, voiceVersion: 1, bookSlug: slug, edition: text.edition, textRevision: text.revision, modelId: "m", configHash: "c", scope: "shared", createdAt: "2026-10-01T00:00:00Z" });
  for (const s of text.sentences) {
    state.segments.push({ libraryKey: key, sentenceId: s.id, ordinal: s.ordinal, status: "ready", jobId: null, storageKey: `audio/${s.id}`, characters: s.text.length, durationMs: 1000, providerCredits: 1, attempts: 1, error: null, readyAt: "2026-10-01T00:00:00Z" });
  }
  return state;
}

const note = (text: string, href: string, at: string) => ({ id: `${href}-${at}`, householdId: DEMO_HOUSEHOLD_ID, text, href, at, readAt: null });

describe("notices inbox", () => {
  it("gives each notice the button that acts on it", () => {
    expect(noticeAction("Mom's reading of Cinderella is ready.", "/family/books/cinderella")).toEqual({ label: "Listen now", href: "/family/books/cinderella/listen" });
    expect(noticeAction("Mom's reading of Cinderella is partly ready.", "/family/books/cinderella")).toEqual({ label: "Listen now", href: "/family/books/cinderella/listen" });
    expect(noticeAction("We couldn't finish preparing Cinderella in Mom. Unused credits were returned.", "/family/books/cinderella")).toEqual({
      label: "See the book",
      href: "/family/books/cinderella",
    });
    expect(noticeAction("Grandma is ready to read!", "/family/narrators?add=v1").label).toBe("Choose who they read to");
    expect(noticeAction("Something else", "/family/settings").label).toBe("Open");
  });

  it("lists a month of notices newest first, marking the ones this grown-up hasn't seen", () => {
    const state = demoFamilyState();
    state.notifications.push(
      note("Mom's reading of The Lion and the Mouse is ready.", `/family/books/${SLUG}`, "2026-10-20T10:00:00Z"),
      note("Mom's reading of Cinderella is ready.", "/family/books/cinderella", "2026-10-21T10:00:00Z"),
      note("Mom's reading of Thumbelina is ready.", "/family/books/thumbelina", "2026-09-01T10:00:00Z"),
    );
    const now = new Date("2026-10-22T12:00:00Z");
    const inbox = familyInbox(state, DEMO_HOUSEHOLD_ID, "sara", now);
    expect(inbox.map((n) => n.text)).toEqual(["Mom's reading of Cinderella is ready.", "Mom's reading of The Lion and the Mouse is ready."]);
    expect(unreadCount(state, DEMO_HOUSEHOLD_ID, "sara", now)).toBe(2);
    state.members.find((m) => m.adultId === "sara")!.noticesSeenThrough = "2026-10-20T10:00:00Z";
    expect(familyInbox(state, DEMO_HOUSEHOLD_ID, "sara", now).map((n) => n.unread)).toEqual([true, false]);
    // Each grown-up has their own unread count.
    expect(unreadCount(state, DEMO_HOUSEHOLD_ID, "ben", now)).toBe(2);
  });
});

describe("family timeline", () => {
  it("shows who finished which book in whose voice, and who is part way, newest first", () => {
    const state = withReadyBook(demoFamilyState());
    const total = bookText(SLUG)!.sentences.length;
    state.progress.push(
      { childId: "maya", bookSlug: SLUG, sentence: total - 1, voiceId: "voice-sara", listenedAt: "2026-10-12T19:00:00Z", updatedAt: "2026-10-12T19:00:00Z" },
      { childId: "leo", bookSlug: SLUG, sentence: Math.round(total / 2), voiceId: "voice-sara", listenedAt: "2026-10-13T19:00:00Z", updatedAt: "2026-10-13T19:00:00Z" },
    );
    const lines = familyTimeline(state, DEMO_HOUSEHOLD_ID).map(timelineLine);
    expect(lines[0]).toMatch(/^Leo is \d+% through The Lion and the Mouse with Mom\.$/);
    expect(lines[1]).toBe("Maya finished The Lion and the Mouse with Mom.");
  });

  it("leaves out pages turned before any audio existed, and other families' children", () => {
    const state = demoFamilyState();
    state.progress.push({ childId: "maya", bookSlug: SLUG, sentence: 3, voiceId: "voice-sara", updatedAt: "2026-10-12T19:00:00Z" });
    expect(familyTimeline(state, DEMO_HOUSEHOLD_ID)).toEqual([]);
    withReadyBook(state);
    expect(familyTimeline(state, DEMO_HOUSEHOLD_ID)).toHaveLength(1);
    expect(familyTimeline(state, "another-home")).toEqual([]);
  });
});
