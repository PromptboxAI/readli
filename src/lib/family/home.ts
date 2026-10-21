import { CATALOG, NEW_BOOKS, MORE_BOOKS_ON_PHONES, findCatalogBook } from "@/lib/library/catalog";
import { narrationFor } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import type { Adult, FamilyState } from "./model";
import { activeApproval, activeChild, activeShare, activeSlot, childVoiceAccess, isActiveMember } from "./permissions";
import { DEFAULT_PLAN, type PlanConfig } from "./plan";

/** Who a card shows: a selfie when there is one, else tinted initials. */
export interface HomePerson {
  name: string;
  avatarUrl: string | null;
  tint: string;
}

export interface HomeKid {
  id: string;
  name: string;
  tint: string;
  /** The story this child listened to most recently. */
  nowPlaying: string | null;
}

export interface HomeBook {
  slug: string;
  title: string;
  coverUrl: string | null;
  tint: string;
  href: string;
  /** One short line under the title. */
  detail: string;
  /** 0 to 100, for stories a child is part way through. */
  percent: number | null;
  voices: HomePerson[];
}

export type StorytellerTone = "family" | "some" | "none" | "waiting";

export interface HomeStoryteller {
  voiceId: string;
  person: HomePerson;
  tone: StorytellerTone;
  detail: string;
  /** Where the card leads: your own unshared voice goes to My voice, anyone else's to narrators. */
  href: string;
}

export interface FamilyHomeView {
  kids: HomeKid[];
  continueListening: HomeBook[];
  ready: HomeBook[];
  fresh: HomeBook[];
  storytellers: HomeStoryteller[];
}

function person(adult: Adult | undefined): HomePerson {
  return { name: adult?.displayName ?? "A storyteller", avatarUrl: adult?.avatarUrl ?? null, tint: adult?.tint ?? "bg-lavender" };
}

function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * Family home for one household: the kids, what each is part way through, stories already prepared
 * in a voice one of the kids may hear now, the newest books, and the family's storytellers with who may hear them.
 * `viewerId` is the signed-in adult, so their own voice reads as theirs rather than someone else's.
 */
export function familyHome(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN, viewerId?: string): FamilyHomeView {
  const kids = state.children.filter((c) => c.householdId === householdId && activeChild(state, c.id));
  const kidIds = new Set(kids.map((k) => k.id));
  const adultById = new Map(state.adults.map((a) => [a.id, a]));
  const voiceOwner = (voiceId: string | null) => {
    const v = voiceId ? state.voices.find((x) => x.id === voiceId) : undefined;
    return v ? adultById.get(v.ownerId) : undefined;
  };

  // A child can page through a story's text before anything is prepared, which saves a place with
  // whichever narrator was picked. Only a place in audio that exists is something to continue.
  const heard = (slug: string, voiceId: string | null) => {
    const text = bookText(slug);
    if (!text || !voiceId || !state.voices.some((v) => v.id === voiceId && v.deletedAt === null)) return null;
    return narrationFor(state, plan, voiceId, text, householdId);
  };
  const hasAudio = (slug: string, voiceId: string | null) => (heard(slug, voiceId)?.status.ready ?? 0) > 0;
  const recent = state.progress
    .filter((p) => kidIds.has(p.childId) && p.sentence > 0 && hasAudio(p.bookSlug, p.voiceId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const continueListening: HomeBook[] = [];
  for (const p of recent) {
    const book = findCatalogBook(p.bookSlug);
    const text = bookText(p.bookSlug);
    const kid = kids.find((k) => k.id === p.childId);
    if (!book || !text || !kid || continueListening.length >= 8) continue;
    const owner = voiceOwner(p.voiceId);
    // How far along, in the text this narrator's audiobook reads.
    const length = heard(p.bookSlug, p.voiceId)?.text.sentences.length ?? text.sentences.length;
    const percent = Math.min(100, Math.round((p.sentence / Math.max(1, length)) * 100));
    continueListening.push({
      slug: book.slug,
      title: book.title,
      coverUrl: book.coverUrl,
      tint: book.tint,
      href: `/family/books/${book.slug}`,
      detail: owner ? `${kid.nickname} · with ${owner.displayName} · ${percent}%` : `${kid.nickname} · ${percent}%`,
      percent,
      voices: owner ? [person(owner)] : [],
    });
  }

  const ready: HomeBook[] = [];
  for (const book of CATALOG) {
    const text = bookText(book.slug);
    if (!text) continue;
    const owners = new Map<string, Adult | undefined>();
    for (const lib of state.libraries) {
      if (lib.bookSlug !== book.slug || !activeShare(state, lib.voiceId, householdId)) continue;
      // An audiobook made with an earlier recording of the voice, or from an earlier text, still counts.
      const voice = state.voices.find((v) => v.id === lib.voiceId && v.deletedAt === null && v.status === "ready");
      if (!voice || owners.has(voice.id)) continue;
      // Ready means a child can play it now: shared, in a slot, on a live plan and approved for someone.
      if (!kids.some((k) => childVoiceAccess(state, k.id, voice.id, plan).allowed)) continue;
      if (narrationFor(state, plan, voice.id, text, householdId).status.readiness === "ready") owners.set(voice.id, adultById.get(voice.ownerId));
    }
    if (!owners.size) continue;
    const who = [...owners.values()].map((a) => a?.displayName ?? "a storyteller");
    ready.push({ slug: book.slug, title: book.title, coverUrl: book.coverUrl, tint: book.tint, href: `/family/books/${book.slug}/listen`, detail: `Ready with ${names(who)}`, percent: null, voices: [...owners.values()].map(person) });
  }

  const fresh: HomeBook[] = [...NEW_BOOKS, ...MORE_BOOKS_ON_PHONES]
    .filter((b, i, all) => all.findIndex((x) => x.slug === b.slug) === i)
    .slice(0, 8)
    .map((b) => {
      // Books still waiting for their text open the library, where they show as coming soon.
      const inCatalog = findCatalogBook(b.slug);
      return { slug: b.slug, title: b.title, coverUrl: b.coverUrl, tint: inCatalog?.tint ?? "bg-sunshine", href: inCatalog ? `/family/books/${b.slug}` : "/family/books", detail: b.author, percent: null, voices: [] };
    });

  const approveHref = kids.length === 1 ? `/family/kids/${kids[0]!.id}/storytellers` : "/family/kids";
  const storytellers: HomeStoryteller[] = state.voices
    .filter((v) => v.deletedAt === null && v.status === "ready" && isActiveMember(state, v.ownerId, householdId))
    .map((v) => {
      const owner = adultById.get(v.ownerId);
      const card = { voiceId: v.id, person: person(owner), href: "/family/narrators" };
      if (!activeShare(state, v.id, householdId)) {
        // Only the owner can share a voice, so your own unshared voice gets a way to do it.
        return v.ownerId === viewerId
          ? { ...card, tone: "waiting" as const, detail: "Your voice: share it with your family", href: "/family/my-voice" }
          : { ...card, tone: "waiting" as const, detail: "Waiting for their permission to share" };
      }
      const approved = kids.filter((k) => activeApproval(state, v.id, k.id, plan)).map((k) => k.nickname);
      if (approved.length && approved.length === kids.length) return { ...card, tone: "family" as const, detail: "Approved for every child" };
      if (approved.length) return { ...card, tone: "some" as const, detail: `Approved for ${names(approved)}` };
      // In a slot but no child may hear them yet: the card goes to where a parent approves them.
      const next = activeSlot(state, v.id, householdId, plan) ? approveHref : "/family/narrators";
      return { ...card, tone: "none" as const, detail: "Not approved for a child yet", href: next };
    })
    .sort((a, b) => ["family", "some", "none", "waiting"].indexOf(a.tone) - ["family", "some", "none", "waiting"].indexOf(b.tone));

  return {
    kids: kids.map((k) => {
      const last = recent.find((p) => p.childId === k.id);
      return { id: k.id, name: k.nickname, tint: k.tint, nowPlaying: last ? (findCatalogBook(last.bookSlug)?.title ?? null) : null };
    }),
    continueListening,
    ready,
    fresh,
    storytellers,
  };
}
