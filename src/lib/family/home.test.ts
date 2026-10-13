import { describe, expect, it } from "vitest";
import { bookText } from "@/lib/narration/text";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import { familyHome } from "./home";
import type { FamilyState } from "./model";

const SLUG = "the-lion-and-the-mouse";

/** Stores every sentence of one book in Mom's voice, as a finished narration. */
function withReadyBook(state: FamilyState, slug = SLUG): FamilyState {
  const text = bookText(slug)!;
  const key = `lib-${slug}`;
  state.libraries.push({ key, voiceId: "voice-sara", voiceVersion: 1, bookSlug: slug, edition: text.edition, textRevision: text.revision, modelId: "m", configHash: "c", scope: "shared", createdAt: "2026-10-01T00:00:00Z" });
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
    state.segments.pop();
    expect(familyHome(state, DEMO_HOUSEHOLD_ID).ready).toEqual([]);
  });

  it("puts each child's latest story first in Continue listening, with who reads it and how far along", () => {
    const state = demoFamilyState();
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

  it("never shows another household's kids", () => {
    expect(familyHome(demoFamilyState(), "some-other-home").kids).toEqual([]);
  });
});
