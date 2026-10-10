import type { Actor } from "@/lib/family/model";
import { requireHouseholdGuardian, type FamilyStore } from "@/lib/family/service";
import { creditBalance, type CreditBalance } from "@/lib/narration/credits";
import { prepareView, type Availability, type PrepareBookView } from "@/lib/narration/narration";
import { CATALOG } from "./catalog";

/**
 * Library discovery for parents (Book Discovery, Generation Credits & Short-Story Launch amendment).
 * The whole catalog stays visible; shorter books come first. Collections are views over the same
 * books, never a filter that hides a book because the family is short of credits.
 */
export interface LibraryCard {
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  tint: string;
  minutes: number;
  chapters: number;
  narrators: { voiceId: string; name: string; availability: Availability; label: string; missingCredits: number }[];
}

export interface FamilyLibrary {
  credits: CreditBalance;
  /** No preparation yet: show recommended short stories first. */
  newFamily: boolean;
  recommended: LibraryCard[];
  collections: { id: string; title: string; description: string; books: LibraryCard[] }[];
  all: LibraryCard[];
}

function card(view: PrepareBookView, coverUrl: string | null, tint: string): LibraryCard {
  return {
    slug: view.book.slug,
    title: view.book.title,
    author: view.book.author,
    coverUrl,
    tint,
    minutes: view.book.minutes,
    chapters: view.book.chapters,
    narrators: view.voices
      .filter((v) => v.availability !== "unavailable")
      .map((v) => ({ voiceId: v.voiceId, name: v.name, availability: v.availability, label: v.availabilityLabel, missingCredits: v.missingCredits })),
  };
}

export async function familyLibrary(store: FamilyStore, actor: Actor | null, householdId: string): Promise<FamilyLibrary> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, householdId);
  const plan = store.plan;
  const cards = await Promise.all(CATALOG.map(async (b) => card(await prepareView(store, actor, householdId, b.slug), b.coverUrl, b.tint)));
  // Shortest first: the launch experience leads with quick stories.
  const all = [...cards].sort((a, b) => a.minutes - b.minutes);
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const pick = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((c): c is LibraryCard => Boolean(c));
  const has = (c: LibraryCard, ...states: Availability[]) => c.narrators.some((n) => states.includes(n.availability));
  const collections = [
    { id: "quick", title: "Quick Stories", description: `Under ${plan.quickStoryMaxMinutes} minutes to listen.`, books: all.filter((c) => c.minutes <= plan.quickStoryMaxMinutes) },
    { id: "bedtime", title: "Bedtime Favorites", description: "Gentle stories for winding down.", books: pick(plan.bedtimeFavorites) },
    { id: "longer", title: "Longer Adventures", description: "Prepare these a chapter at a time.", books: all.filter((c) => c.minutes > plan.quickStoryMaxMinutes) },
    { id: "fits", title: "Stories You Can Create With Your Balance", description: "Enough credits for a whole book in one of your family's voices.", books: all.filter((c) => has(c, "available")) },
    { id: "prepared", title: "Already Prepared for Your Family", description: "Ready to play now, no credits needed.", books: all.filter((c) => has(c, "ready", "partial")) },
  ];
  return {
    credits: creditBalance(state, plan, householdId),
    newFamily: !state.jobs.some((j) => j.householdId === householdId),
    recommended: pick(plan.recommendedShortStories),
    collections,
    all,
  };
}
