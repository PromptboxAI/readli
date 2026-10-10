import type { FamilyState } from "@/lib/family/model";
import type { PlanConfig } from "@/lib/family/plan";
import { toneWav } from "@/lib/voice/stub";
import { modelCost } from "./costs";
import { allowanceCredits, periodOf } from "./credits";
import { libraryFor } from "./narration";
import type { MemoryNarrationStorage } from "./storage";
import { bookText } from "./text";
import { DEMO_BOOKS } from "@/lib/content/demo-books";

/**
 * Prepared narrations for the preview family, so the kids player has something to switch between:
 * Mom has every book, Dad has Peter Rabbit, Grandma June has The Lion and the Mouse and the start
 * of Peter Rabbit. Nana Rose and Aunt Priya have nothing prepared yet. Audio is the stand-in tone.
 */
const SEED: [voiceId: string, slug: string, sentences: number | "all"][] = [
  ...DEMO_BOOKS.filter((b) => b.passageText).map((b) => ["voice-sara", b.slug, "all"] as [string, string, "all"]),
  ["voice-ben", "the-tale-of-peter-rabbit", "all"],
  ["voice-june", "the-lion-and-the-mouse", "all"],
  ["voice-june", "the-tale-of-peter-rabbit", 2],
];

/**
 * The preview family has spent most of this month's credits and part of its welcome credits, so
 * every availability state shows: short books are Available to generate, the longer fables need
 * more credits (or a chapter at a time).
 */
function seedDemoCredits(state: FamilyState, plan: PlanConfig, householdId: string, at: Date) {
  const iso = at.toISOString();
  const month = `subscription:${periodOf(iso)}`;
  const promo = "demo-welcome";
  state.creditLots.push({
    id: promo,
    householdId,
    source: "promotional",
    credits: plan.welcomePromoCredits,
    grantedAt: new Date(at.getTime() - 7 * 86_400_000).toISOString(),
    expiresAt: new Date(at.getTime() + 23 * 86_400_000).toISOString(),
    note: "Welcome credits for your first stories",
  });
  const spend = (lotId: string, credits: number) => {
    if (credits <= 0) return;
    for (const kind of ["reserve", "commit"] as const) state.ledger.push({ id: `demo-${lotId}-${kind}`, householdId, lotId, kind, credits, jobId: null, sentenceId: null, at: iso });
  };
  spend(month, allowanceCredits(plan) - 100);
  spend(promo, plan.welcomePromoCredits - 120);
}

export async function seedDemoNarrations(state: FamilyState, storage: MemoryNarrationStorage, plan: PlanConfig, householdId: string, now = new Date()) {
  seedDemoCredits(state, plan, householdId, now);
  const at = "2026-10-03T12:00:00.000Z";
  const tone = toneWav(1);
  for (const [voiceId, slug, count] of SEED) {
    const text = bookText(slug);
    if (!text) continue;
    const library = libraryFor(state, plan, voiceId, text, householdId);
    if (!state.libraries.some((l) => l.key === library.key)) state.libraries.push({ ...library, createdAt: at });
    for (const s of text.sentences.slice(0, count === "all" ? undefined : count)) {
      const storageKey = `${library.key.replaceAll(":", "/")}/${s.id}`;
      await storage.put(storageKey, tone, "audio/wav");
      state.segments.push({
        libraryKey: library.key,
        sentenceId: s.id,
        ordinal: s.ordinal,
        status: "ready",
        jobId: null,
        storageKey,
        characters: s.text.length,
        durationMs: Math.round((s.text.length / modelCost(library.modelId).charactersPerMinute) * 60_000),
        providerCredits: s.text.length,
        attempts: 1,
        error: null,
        readyAt: at,
      });
    }
  }
}
