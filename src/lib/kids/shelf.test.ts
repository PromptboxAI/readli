import { describe, expect, it } from "vitest";
import { demoFamilyState } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { MemoryFamilyStore } from "@/lib/family/service";
import { bookText } from "@/lib/narration/text";
import { kidsShelf, NEWEST_SHOWN } from "./shelf";

const maya: Actor = { kind: "child", childId: "maya" };
const NOW = Date.parse("2026-11-08T12:00:00Z");

/** Stores every sentence of one book in Mom's voice, finished at `readyAt`. */
function withReadyBook(state: FamilyState, slug: string, readyAt: string): FamilyState {
  const text = bookText(slug)!;
  const key = `lib-${slug}-voice-sara`;
  state.libraries.push({ key, voiceId: "voice-sara", voiceVersion: 1, bookSlug: slug, edition: text.edition, textRevision: text.revision, modelId: "m", configHash: "c", scope: "shared", createdAt: readyAt });
  for (const s of text.sentences) {
    state.segments.push({ libraryKey: key, sentenceId: s.id, ordinal: s.ordinal, status: "ready", jobId: null, storageKey: `audio/${s.id}`, characters: s.text.length, durationMs: 1000, providerCredits: 1, attempts: 1, error: null, readyAt });
  }
  return state;
}

async function shelf(state: FamilyState) {
  return kidsShelf(new MemoryFamilyStore(state), maya, state, "maya", NOW);
}

describe("kids shelf: New stories", () => {
  it("shows stories prepared in the last two weeks, newest first, and keeps them out of Ready to listen", async () => {
    let state = demoFamilyState();
    state = withReadyBook(state, "the-lion-and-the-mouse", "2026-11-07T10:00:00Z");
    state = withReadyBook(state, "the-tale-of-peter-rabbit", "2026-11-08T09:00:00Z");
    state = withReadyBook(state, "the-three-little-pigs", "2026-10-01T09:00:00Z");
    const { newest, ready } = await shelf(state);
    expect(newest.map((b) => b.book.slug)).toEqual(["the-tale-of-peter-rabbit", "the-lion-and-the-mouse"]);
    expect(newest[0]?.preparedAt).toBe("2026-11-08T09:00:00Z");
    expect(ready.map((b) => b.book.slug)).toEqual(["the-three-little-pigs"]);
  });

  it("moves a new story back to Ready to listen once the child starts it", async () => {
    const state = withReadyBook(demoFamilyState(), "the-lion-and-the-mouse", "2026-11-07T10:00:00Z");
    const total = bookText("the-lion-and-the-mouse")!.sentences.length;
    state.progress.push({ childId: "maya", bookSlug: "the-lion-and-the-mouse", sentence: total - 1, voiceId: "voice-sara", updatedAt: "2026-11-08T08:00:00Z" });
    const { newest, ready } = await shelf(state);
    expect(newest).toEqual([]);
    expect(ready.map((b) => b.book.slug)).toEqual(["the-lion-and-the-mouse"]);
  });

  it("shows at most one row of new stories", async () => {
    let state = demoFamilyState();
    const slugs = ["the-lion-and-the-mouse", "the-tale-of-peter-rabbit", "the-three-little-pigs", "the-owl-and-the-pussy-cat", "the-princess-and-the-pea", "winnie-the-pooh"].filter((s) => bookText(s));
    slugs.forEach((s, i) => (state = withReadyBook(state, s, `2026-11-0${i + 1}T10:00:00Z`)));
    const { newest, ready } = await shelf(state);
    expect(newest).toHaveLength(Math.min(NEWEST_SHOWN, slugs.length));
    expect(newest.length + ready.length).toBe(slugs.length);
  });
});
