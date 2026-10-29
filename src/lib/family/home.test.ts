import { describe, expect, it } from "vitest";
import { bookText } from "@/lib/narration/text";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import { familyHome, homeNotice, noticeText } from "./home";
import type { FamilyState } from "./model";

const SLUG = "the-lion-and-the-mouse";

/** Stores every sentence of one book in Mom's voice, as a finished narration. */
function withReadyBook(state: FamilyState, slug = SLUG, voiceId = "voice-sara"): FamilyState {
  const text = bookText(slug)!;
  const key = `lib-${slug}-${voiceId}`;
  state.libraries.push({ key, voiceId, voiceVersion: 1, bookSlug: slug, edition: text.edition, textRevision: text.revision, modelId: "m", configHash: "c", scope: "shared", createdAt: "2026-10-01T00:00:00Z" });
  for (const s of text.sentences) {
    state.segments.push({ libraryKey: key, sentenceId: s.id, ordinal: s.ordinal, status: "ready", jobId: null, storageKey: `audio/${s.id}`, characters: s.text.length, durationMs: 1000, providerCredits: 1, attempts: 1, error: null, readyAt: "2026-10-01T00:00:00Z" });
  }
  return state;
}

describe("family home", () => {
  it("lists the household's kids and storytellers, approved for everyone first and waiting last", () => {
    const view = familyHome(demoFamilyState(), DEMO_HOUSEHOLD_ID);
    expect(view.kids.map((k) => k.name)).toEqual(["Maya", "Leo"]);
    const byName = Object.fromEntries(view.storytellers.map((s) => [s.person.name, s]));
    expect(byName["Mom"]?.tone).toBe("family");
    expect(byName["Dad"]?.detail).toBe("Approved for Leo");
    expect(byName["Grandma June"]?.detail).toBe("Approved for Maya");
    expect(byName["Aunt Priya"]?.tone).toBe("none");
    expect(byName["Grandpa Lou"]?.tone).toBe("waiting");
    // A voice still processing isn't a storyteller yet.
    expect(byName["Uncle Sam"]).toBeUndefined();
    expect(view.storytellers[0]?.person.name).toBe("Mom");
    expect(view.storytellers.at(-1)?.tone).toBe("waiting");
  });

  it("shows a story as ready only when every sentence is stored in a voice shared with the family", () => {
    const state = withReadyBook(demoFamilyState());
    expect(familyHome(state, DEMO_HOUSEHOLD_ID).ready.map((b) => [b.slug, b.detail])).toEqual([[SLUG, "Ready with Mom"]]);
    // A missing story line keeps it off the shelf (a missing closing "The End." alone doesn't).
    state.segments.shift();
    expect(familyHome(state, DEMO_HOUSEHOLD_ID).ready).toEqual([]);
  });

  it("keeps a prepared book in view when no child can hear its narrator yet, with the step that's missing", () => {
    const state = withReadyBook(withReadyBook(demoFamilyState()), SLUG, "voice-priya");
    const view = familyHome(state, DEMO_HOUSEHOLD_ID);
    // Aunt Priya shared her voice but has no narrator slot, so her reading is on no child's shelf.
    expect(view.unassigned.map((b) => [b.slug, b.narrators.map((n) => n.name), b.detail, b.href])).toEqual([
      [SLUG, ["Aunt Priya"], "Give Aunt Priya a narrator slot, then choose which kids hear it", `/family/books/${SLUG}`],
    ]);
    // Mom's reading of the same book is on the shelf as usual.
    expect(view.shelf.map((b) => b.slug)).toEqual([SLUG]);
    expect(familyHome(withReadyBook(demoFamilyState()), DEMO_HOUSEHOLD_ID).unassigned).toEqual([]);
  });

  it("puts each child's latest story first in Continue listening, with who reads it and how far along", () => {
    const state = withReadyBook(demoFamilyState());
    const total = bookText(SLUG)!.sentences.length;
    state.progress.push(
      { childId: "maya", bookSlug: SLUG, sentence: Math.round(total / 2), voiceId: "voice-sara", updatedAt: "2026-10-12T19:00:00Z" },
      { childId: "leo", bookSlug: "the-tale-of-peter-rabbit", sentence: 0, voiceId: "voice-ben", updatedAt: "2026-10-12T20:00:00Z" },
    );
    const view = familyHome(state, DEMO_HOUSEHOLD_ID);
    expect(view.continueListening).toHaveLength(1);
    expect(view.continueListening[0]?.detail).toMatch(/^Maya · with Mom · \d+%$/);
    expect(view.kids.find((k) => k.id === "maya")?.nowPlaying).toBe("The Lion and the Mouse");
    // A story not started yet isn't "continue".
    expect(view.kids.find((k) => k.id === "leo")?.nowPlaying).toBeNull();
  });

  it("leaves out a story a child paged through before any of it was prepared in that voice", () => {
    const state = demoFamilyState();
    state.progress.push({ childId: "maya", bookSlug: SLUG, sentence: 1, voiceId: "voice-sara", updatedAt: "2026-10-12T19:00:00Z" });
    const before = familyHome(state, DEMO_HOUSEHOLD_ID);
    expect(before.continueListening).toEqual([]);
    expect(before.kids.find((k) => k.id === "maya")?.nowPlaying).toBeNull();
    withReadyBook(state);
    expect(familyHome(state, DEMO_HOUSEHOLD_ID).continueListening.map((b) => b.slug)).toEqual([SLUG]);
  });

  it("never shows another household's kids", () => {
    expect(familyHome(demoFamilyState(), "some-other-home").kids).toEqual([]);
  });

  it("gives your own unshared voice a way to share it, instead of waiting on yourself", () => {
    const own = familyHome(demoFamilyState(), DEMO_HOUSEHOLD_ID, undefined, "lou").storytellers.find((s) => s.voiceId === "voice-lou");
    expect(own).toMatchObject({ tone: "waiting", detail: "Your voice: share it with your family", href: "/family/my-voice" });
    const theirs = familyHome(demoFamilyState(), DEMO_HOUSEHOLD_ID, undefined, "sara").storytellers.find((s) => s.voiceId === "voice-lou");
    expect(theirs).toMatchObject({ detail: "Waiting for their permission to share", href: "/family/narrators" });
  });

  it("stops calling a story ready when no child can play it, such as after the plan ends", () => {
    const state = withReadyBook(demoFamilyState());
    for (const e of state.entitlements) e.endsAt = "2026-01-01T00:00:00Z";
    expect(familyHome(state, DEMO_HOUSEHOLD_ID).ready).toEqual([]);
  });

  it("stops calling a story ready when its storyteller isn't approved for any child", () => {
    const state = withReadyBook(demoFamilyState());
    state.approvals = state.approvals.filter((a) => a.voiceId !== "voice-sara");
    expect(familyHome(state, DEMO_HOUSEHOLD_ID).ready).toEqual([]);
  });

  it("sends a storyteller nobody is approved to hear to the next step: a slot, then approvals", () => {
    const state = demoFamilyState();
    state.approvals = state.approvals.filter((a) => a.voiceId !== "voice-ben");
    const cards = familyHome(state, DEMO_HOUSEHOLD_ID).storytellers;
    expect(cards.find((s) => s.voiceId === "voice-priya")).toMatchObject({ tone: "none", href: "/family/narrators" });
    expect(cards.find((s) => s.voiceId === "voice-ben")).toMatchObject({ tone: "none", href: "/family/narrators?choose=voice-ben" });
  });

  it("puts every prepared book on the bookshelf once, with all its narrators and each child's own place", () => {
    const state = withReadyBook(withReadyBook(demoFamilyState()), SLUG, "voice-ben");
    const total = bookText(SLUG)!.sentences.length;
    let shelf = familyHome(state, DEMO_HOUSEHOLD_ID).shelf;
    expect(shelf.map((b) => b.slug)).toEqual([SLUG]);
    expect(shelf[0]!.narrators.map((n) => n.name)).toEqual(["Mom", "Dad"]);
    // Prepared but nobody has listened: ready, whatever the narration job said.
    expect(shelf[0]!.state).toBe("ready");
    expect(shelf[0]!.kids).toEqual([
      { id: "maya", name: "Maya", percent: null },
      { id: "leo", name: "Leo", percent: null },
    ]);

    state.progress.push({ childId: "maya", bookSlug: SLUG, sentence: Math.round(total / 2), voiceId: "voice-sara", updatedAt: "2026-10-12T19:00:00Z" });
    const view = familyHome(state, DEMO_HOUSEHOLD_ID);
    shelf = view.shelf;
    expect(shelf[0]!.state).toBe("progress");
    expect(shelf[0]!.kids.find((k) => k.id === "maya")?.percent).toBeGreaterThan(0);
    expect(shelf[0]!.kids.find((k) => k.id === "leo")?.percent).toBeNull();
    expect(view.kids.find((k) => k.id === "maya")).toMatchObject({ current: { slug: SLUG, narrator: "Mom" }, readyCount: 1, notStarted: 0 });
    expect(view.kids.find((k) => k.id === "leo")).toMatchObject({ current: null, readyCount: 1, notStarted: 1, suggested: "The Lion and the Mouse" });
  });

  it("calls a book completed only when a child reached its end", () => {
    const state = withReadyBook(demoFamilyState());
    const sentences = bookText(SLUG)!.sentences;
    const last = sentences.at(-1)!.text === "The End." ? sentences.length - 2 : sentences.length - 1;
    state.progress.push({ childId: "maya", bookSlug: SLUG, sentence: last, voiceId: "voice-sara", updatedAt: "2026-10-12T19:00:00Z" });
    const view = familyHome(state, DEMO_HOUSEHOLD_ID);
    expect(view.shelf[0]).toMatchObject({ state: "done" });
    expect(view.shelf[0]!.kids.find((k) => k.id === "maya")?.percent).toBe(100);
    // A finished story isn't the one Maya is in the middle of.
    expect(view.kids.find((k) => k.id === "maya")?.current).toBeNull();
  });

  it("combines new readings into one notice that each grown-up dismisses for themselves and that expires after a week", () => {
    const state = demoFamilyState();
    const note = (text: string, slug: string, at: string) => ({ id: `${slug}-${at}`, householdId: DEMO_HOUSEHOLD_ID, text, href: `/family/books/${slug}`, at, readAt: null });
    state.notifications.push(
      note("Mom's reading of The Lion and the Mouse is ready.", SLUG, "2026-10-20T10:00:00Z"),
      note("Mom's reading of The Elves and the Shoemaker is ready.", "the-elves-and-the-shoemaker", "2026-10-20T11:00:00Z"),
      note("Mom's reading of The Tortoise and the Hare is ready.", "the-tortoise-and-the-hare", "2026-10-01T11:00:00Z"),
    );
    const now = new Date("2026-10-21T12:00:00Z");
    const mom = homeNotice(state, DEMO_HOUSEHOLD_ID, "sara", now)!;
    // The three-week-old one has expired; its audiobook isn't touched.
    expect(noticeText(mom)).toBe("2 new readings ready: The Lion and the Mouse and The Elves and the Shoemaker, read by Mom.");
    expect(mom.through).toBe("2026-10-20T11:00:00Z");
    state.members.find((m) => m.adultId === "sara")!.noticesSeenThrough = mom.through;
    expect(homeNotice(state, DEMO_HOUSEHOLD_ID, "sara", now)).toBeNull();
    expect(homeNotice(state, DEMO_HOUSEHOLD_ID, "ben", now)).not.toBeNull();
    // A reading that finishes later shows again.
    state.notifications.push(note("Dad's reading of The Lion and the Mouse is ready.", SLUG, "2026-10-21T09:00:00Z"));
    expect(noticeText(homeNotice(state, DEMO_HOUSEHOLD_ID, "sara", now)!)).toBe("New reading ready: The Lion and the Mouse, read by Dad.");
    expect(homeNotice(state, DEMO_HOUSEHOLD_ID, "sara", new Date("2026-10-29T12:00:00Z"))).toBeNull();
  });
});
