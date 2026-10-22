import { CATALOG, NEW_BOOKS, MORE_BOOKS_ON_PHONES, findCatalogBook } from "@/lib/library/catalog";
import { THE_END } from "@/lib/content/the-end";
import { bookMinutes, libraryFor, libraryStatus } from "@/lib/narration/narration";
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

/** Where one child is in a story, for their card on Home. */
export interface HomeKidStory {
  slug: string;
  title: string;
  percent: number;
  /** Who reads it to this child, when that voice is still known. */
  narrator: string | null;
}

export interface HomeKid {
  id: string;
  name: string;
  tint: string;
  /** The story this child listened to most recently. */
  nowPlaying: string | null;
  /** That story, unless they finished it; it carries the child's own place. */
  current: HomeKidStory | null;
  /** Prepared stories this child may hear now, and how many of those they haven't started. */
  readyCount: number;
  notStarted: number;
  /** A prepared story to try first, when nothing is under way. */
  suggested: string | null;
}

export type ShelfState = "progress" | "ready" | "done";

/** One child's place in one shelf book: null when not started, 100 when finished. */
export interface ShelfKid {
  id: string;
  name: string;
  percent: number | null;
}

/** One prepared audiobook on the Family bookshelf, with every narrator version grouped under the book. */
export interface ShelfBook {
  slug: string;
  title: string;
  coverUrl: string | null;
  tint: string;
  /** The grown-up player, which never moves a child's place. */
  href: string;
  state: ShelfState;
  narrators: HomePerson[];
  minutes: number;
  /** The kids who may hear at least one of its narrators, each with their own place. */
  kids: ShelfKid[];
  /** Latest listening by any child, for ordering. */
  touchedAt: string | null;
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
  /** The signed-in adult's own voice. */
  mine: boolean;
  /** Where the card leads: your own unshared voice goes to My voice, anyone else's to narrators. */
  href: string;
}

export interface FamilyHomeView {
  kids: HomeKid[];
  continueListening: HomeBook[];
  ready: HomeBook[];
  fresh: HomeBook[];
  /** Every prepared audiobook a child of this family may hear, one entry per book. */
  shelf: ShelfBook[];
  storytellers: HomeStoryteller[];
}

function person(adult: Adult | undefined): HomePerson {
  return { name: adult?.displayName ?? "A storyteller", avatarUrl: adult?.avatarUrl ?? null, tint: adult?.tint ?? "bg-lavender" };
}

/** A child's saved place on its last sentence (or the one before a closing "The End.") means they reached the end. */
function finished(sentences: readonly { text: string }[], sentence: number): boolean {
  const last = sentences.at(-1)?.text === THE_END ? sentences.length - 2 : sentences.length - 1;
  return sentence >= last;
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
  const hasAudio = (slug: string, voiceId: string | null) => {
    const text = bookText(slug);
    if (!text || !voiceId || !state.voices.some((v) => v.id === voiceId && v.deletedAt === null)) return false;
    return libraryStatus(state, libraryFor(state, plan, voiceId, text, householdId), text).ready > 0;
  };
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
    const percent = Math.min(100, Math.round((p.sentence / Math.max(1, text.sentences.length)) * 100));
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
      const voice = state.voices.find((v) => v.id === lib.voiceId && v.deletedAt === null && v.status === "ready" && v.version === lib.voiceVersion);
      if (!voice || owners.has(voice.id)) continue;
      // Ready means a child can play it now: shared, in a slot, on a live plan and approved for someone.
      if (!kids.some((k) => childVoiceAccess(state, k.id, voice.id, plan).allowed)) continue;
      if (libraryStatus(state, lib, text).readiness === "ready") owners.set(voice.id, adultById.get(voice.ownerId));
    }
    if (!owners.size) continue;
    const who = [...owners.values()].map((a) => a?.displayName ?? "a storyteller");
    ready.push({ slug: book.slug, title: book.title, coverUrl: book.coverUrl, tint: book.tint, href: `/family/books/${book.slug}/listen`, detail: `Ready with ${names(who)}`, percent: null, voices: [...owners.values()].map(person) });
  }

  // The bookshelf: every book with a narration a child here may hear, one entry per book whatever the
  // number of narrators, and each child's own place in it. A finished narration says nothing about listening.
  const shelf: ShelfBook[] = [];
  for (const book of CATALOG) {
    const text = bookText(book.slug);
    if (!text) continue;
    const narrators = new Map<string, Adult | undefined>();
    const hearers = new Set<string>();
    for (const lib of state.libraries) {
      if (lib.bookSlug !== book.slug || !activeShare(state, lib.voiceId, householdId)) continue;
      const voice = state.voices.find((v) => v.id === lib.voiceId && v.deletedAt === null && v.status === "ready" && v.version === lib.voiceVersion);
      if (!voice) continue;
      const allowed = kids.filter((k) => childVoiceAccess(state, k.id, voice.id, plan).allowed);
      if (!allowed.length) continue;
      const status = libraryStatus(state, lib, text);
      // A partly prepared reading stays on the shelf only while a child is already part way through it.
      const started = allowed.some((k) => state.progress.some((p) => p.childId === k.id && p.bookSlug === book.slug && p.voiceId === voice.id && p.sentence > 0));
      if (status.readiness !== "ready" && !(started && status.ready > 0)) continue;
      narrators.set(voice.id, adultById.get(voice.ownerId));
      for (const k of allowed) hearers.add(k.id);
    }
    if (!narrators.size) continue;
    const shelfKids: ShelfKid[] = kids
      .filter((k) => hearers.has(k.id))
      .map((k) => {
        const p = recent.find((x) => x.childId === k.id && x.bookSlug === book.slug);
        if (!p) return { id: k.id, name: k.nickname, percent: null };
        const percent = finished(text.sentences, p.sentence) ? 100 : Math.min(99, Math.round((p.sentence / Math.max(1, text.sentences.length)) * 100));
        return { id: k.id, name: k.nickname, percent };
      });
    const touchedAt = recent.find((x) => x.bookSlug === book.slug && hearers.has(x.childId))?.updatedAt ?? null;
    const shelfState: ShelfState = shelfKids.some((k) => k.percent !== null && k.percent < 100) ? "progress" : shelfKids.some((k) => k.percent === 100) ? "done" : "ready";
    shelf.push({
      slug: book.slug,
      title: book.title,
      coverUrl: book.coverUrl,
      tint: book.tint,
      href: `/family/books/${book.slug}/listen`,
      state: shelfState,
      narrators: [...narrators.values()].map(person),
      minutes: Math.max(1, Math.round(bookMinutes(text, plan))),
      kids: shelfKids,
      touchedAt,
    });
  }
  const order: ShelfState[] = ["progress", "ready", "done"];
  shelf.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || (b.touchedAt ?? "").localeCompare(a.touchedAt ?? "") || a.minutes - b.minutes);

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
      const card = { voiceId: v.id, person: person(owner), mine: v.ownerId === viewerId, href: "/family/narrators" };
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
      const open = recent.find((p) => p.childId === k.id && !finished(bookText(p.bookSlug)?.sentences ?? [], p.sentence));
      const openBook = open ? findCatalogBook(open.bookSlug) : undefined;
      const text = open ? bookText(open.bookSlug) : null;
      const theirs = shelf.filter((b) => b.kids.some((x) => x.id === k.id));
      const unstarted = theirs.filter((b) => b.kids.find((x) => x.id === k.id)?.percent === null);
      const suggested = [...unstarted].sort((a, b) => a.minutes - b.minutes)[0];
      return {
        id: k.id,
        name: k.nickname,
        tint: k.tint,
        nowPlaying: last ? (findCatalogBook(last.bookSlug)?.title ?? null) : null,
        current:
          open && openBook && text
            ? {
                slug: openBook.slug,
                title: openBook.title,
                percent: Math.min(99, Math.round((open.sentence / Math.max(1, text.sentences.length)) * 100)),
                narrator: voiceOwner(open.voiceId)?.displayName ?? null,
              }
            : null,
        readyCount: theirs.length,
        notStarted: unstarted.length,
        suggested: suggested?.title ?? null,
      };
    }),
    continueListening,
    ready,
    fresh,
    shelf,
    storytellers,
  };
}

/** How long a "ready" notice stays on Home. Expiry only hides the notice; the audiobook stays on the shelf. */
export const NOTICE_DAYS = 7;

export interface HomeNotice {
  /** Books whose reading finished, by title, and who read them. */
  titles: string[];
  narrators: string[];
  /** Anything else worth saying, such as a reading only partly ready or one that failed, in its own words. */
  other: string[];
  /** The newest notice included, so dismissing never hides one that arrives later. */
  through: string;
}

const READY = /^(.+)'s reading of (.+) is ready\.$/;

/**
 * One combined notice for the adult's household: the narration updates from the last seven days that
 * this adult hasn't dismissed. Dismissal is kept per adult, so one parent clearing it leaves the other's.
 */
export function homeNotice(state: FamilyState, householdId: string, adultId: string, now: Date = new Date()): HomeNotice | null {
  const since = new Date(now.getTime() - NOTICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const seen = state.members.find((m) => m.householdId === householdId && m.adultId === adultId && m.removedAt === null)?.noticesSeenThrough ?? null;
  const notes = state.notifications.filter((n) => n.householdId === householdId && n.at > since && (!seen || n.at > seen));
  if (!notes.length) return null;
  const titles: string[] = [];
  const narrators: string[] = [];
  const other: string[] = [];
  for (const n of notes) {
    const m = READY.exec(n.text);
    if (!m) {
      if (!other.includes(n.text)) other.push(n.text);
      continue;
    }
    const title = findCatalogBook(n.href.split("/").pop() ?? "")?.title ?? m[2]!;
    if (!titles.includes(title)) titles.push(title);
    if (!narrators.includes(m[1]!)) narrators.push(m[1]!);
  }
  return { titles, narrators, other, through: notes.reduce((a, n) => (n.at > a ? n.at : a), notes[0]!.at) };
}

/** "2 new readings ready: A and B, read by Daddy." */
export function noticeText(n: HomeNotice): string {
  const parts: string[] = [];
  if (n.titles.length) {
    const lead = n.titles.length === 1 ? "New reading ready" : `${n.titles.length} new readings ready`;
    parts.push(`${lead}: ${names(n.titles)}, read by ${names(n.narrators)}.`);
  }
  return [...parts, ...n.other].join(" ");
}
