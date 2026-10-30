import Image from "next/image";
import Link from "next/link";
import { SessionButton } from "@/components/family/SessionButton";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import type { HomeKid, HomeStoryteller, ShelfBook, ShelfKid, UnassignedBook } from "@/lib/family/home";

function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
      <span className="block h-full rounded-full bg-mint-deep" style={{ width: `${percent}%` }} />
    </span>
  );
}

/**
 * One card per child. However many kids there are, every card has the same rows in the same order,
 * so Open Readli Kids sits in the same place on each: one child gets a wide row, two get detailed
 * cards, and three to six get compact cards in a grid that never needs sideways scrolling.
 */
export function KidCards({ kids }: { kids: HomeKid[] }) {
  const layout = kids.length === 1 ? "wide" : kids.length === 2 ? "detailed" : "compact";
  // Compact cards wrap into even rows (four kids two by two) instead of growing or scrolling sideways.
  const grid = layout === "wide" ? "" : layout === "detailed" ? "sm:grid-cols-2" : kids.length === 4 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
  return (
    <ul className={`grid gap-3 ${grid}`} data-testid="home-kids" data-layout={layout}>
      {kids.map((k) => (
        <li key={k.id} className="min-w-0">
          {layout === "compact" ? <CompactKid kid={k} /> : <DetailedKid kid={k} wide={layout === "wide"} />}
        </li>
      ))}
    </ul>
  );
}

/** Same pill as the primary button, sized so it fits the narrowest card without wrapping. */
function OpenKids({ kid, compact = false, className = "" }: { kid: HomeKid; compact?: boolean; className?: string }) {
  const size = compact ? "px-3 text-base" : "px-6 text-lg";
  return (
    <SessionButton
      as={`child:${kid.id}`}
      next="/kids"
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-full bg-coral-deep font-display font-semibold text-white shadow-[0_4px_0_#8f2a1e] transition-transform hover:-translate-y-0.5 active:scale-[0.97] ${size} ${className}`}
    >
      <span className="sr-only">Open {kid.name}&apos;s Readli Kids</span>
      <span aria-hidden="true">Open Readli Kids</span>
    </SessionButton>
  );
}

function readyLine(kid: HomeKid): string {
  if (!kid.readyCount) return "Nothing prepared for them yet";
  return `${kid.readyCount} ${kid.readyCount === 1 ? "story" : "stories"} ready`;
}

function DetailedKid({ kid, wide }: { kid: HomeKid; wide: boolean }) {
  const story = (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-ivory p-3">
      <p className="line-clamp-2 font-semibold leading-snug">{kid.current?.title ?? "No story started"}</p>
      <Bar percent={kid.current?.percent ?? 0} />
      <p className="text-sm text-muted">
        {kid.current
          ? `${kid.current.percent}%${kid.current.narrator ? ` · read by ${kid.current.narrator}` : ""}`
          : kid.suggested
            ? `Suggested first: ${kid.suggested}`
            : "Prepare a story in Books"}
      </p>
    </div>
  );
  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10 ${wide ? "md:grid md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] md:items-center md:gap-5" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <StorytellerAvatar name={kid.name} avatarUrl={null} tint={kid.tint} />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold">{kid.name}</p>
          <p className="truncate text-sm text-muted">{readyLine(kid)}</p>
        </div>
      </div>
      {story}
      <OpenKids kid={kid} className={wide ? "" : "mt-auto"} />
    </div>
  );
}

function CompactKid({ kid }: { kid: HomeKid }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 sm:p-4">
      <div className="flex min-w-0 items-center gap-2">
        <StorytellerAvatar name={kid.name} avatarUrl={null} tint={kid.tint} size="sm" />
        <p className="truncate font-display text-xl font-semibold">{kid.name}</p>
      </div>
      <p className="line-clamp-2 min-h-[2lh] text-sm font-semibold leading-snug">{kid.current?.title ?? "No story started"}</p>
      <Bar percent={kid.current?.percent ?? 0} />
      <p className="text-sm text-muted">
        {kid.current ? `${kid.current.percent}%` : kid.notStarted ? `${kid.notStarted} ready to start` : readyLine(kid)}
      </p>
      <OpenKids kid={kid} compact className="mt-auto" />
    </div>
  );
}

function kidPlaces(kids: ShelfKid[]): string[] {
  const place = (k: ShelfKid) => `${k.name} · ${k.percent === null ? "not started" : k.percent === 100 ? "finished" : `${k.percent}%`}`;
  // With three or more kids, the ones who haven't started are counted rather than listed.
  if (kids.length < 3) return kids.map(place);
  const started = kids.filter((k) => k.percent !== null);
  const waiting = kids.length - started.length;
  return [...started.map(place), ...(waiting ? [`${waiting} not started`] : [])];
}

/** How many shelf books Home shows before "View all books". */
export const HOME_SHELF_BOOKS = 4;

/**
 * Prepared audiobooks the kids may hear, one card per book with its narrators grouped, two across on
 * wider screens. A book has no status of its own: each child's place shows on it and only moves in
 * Readli Kids. The whole card opens the book's page; only Listen opens the grown-up player.
 */
export function FamilyBookshelf({ books }: { books: ShelfBook[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="shelf-ready">
      {books.map((b) => (
        <li
          key={b.slug}
          className="relative flex gap-3 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 focus-within:ring-ink hover:ring-ink/30"
          data-testid={`shelf-book-${b.slug}`}
          data-state={b.state}
        >
          <span className="block w-16 shrink-0 self-start overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
            {b.coverUrl ? (
              <Image src={b.coverUrl} alt="" width={64} height={85} className="aspect-[3/4] w-full object-cover" />
            ) : (
              <span className={`flex aspect-[3/4] w-full items-center justify-center p-1 text-center font-display text-[0.6rem] leading-tight font-semibold ${b.tint}`}>{b.title}</span>
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Link
              href={b.bookHref}
              className="font-display text-lg leading-tight font-semibold outline-none after:absolute after:inset-0 after:rounded-3xl"
              data-testid={`home-book-page-${b.slug}`}
            >
              {b.title}
            </Link>
            <p className="text-sm text-muted">
              Read by {names(b.narrators.map((n) => n.name))} · {b.minutes} min
            </p>
            <ul className="flex flex-col text-sm" aria-label="Each child's place">
              {kidPlaces(b.kids).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Link
              href={b.href}
              className="relative z-10 mt-1 inline-flex min-h-10 items-center gap-1.5 self-start rounded-xl bg-ink px-4 font-display font-semibold text-white hover:bg-ink/85"
              data-testid={`home-book-${b.slug}`}
            >
              <span aria-hidden="true">▶</span>
              <span>
                Listen<span className="sr-only"> to {b.title}</span>
              </span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

const STATUS: Record<HomeStoryteller["tone"], { label: string; className: string }> = {
  family: { label: "Available", className: "bg-mint/50 text-mint-deep" },
  some: { label: "Available", className: "bg-mint/50 text-mint-deep" },
  none: { label: "Not approved yet", className: "bg-sky/30" },
  waiting: { label: "Waiting", className: "bg-lavender/40" },
};

/** The family's storytellers, each with who may hear them, and the narrator slots in use. */
export function StorytellersCard({ storytellers, slotLine }: { storytellers: HomeStoryteller[]; slotLine: string | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" aria-labelledby="storytellers-h">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="storytellers-h" className="font-display text-2xl font-semibold">
          Family storytellers
        </h2>
        <Link href="/family/kids" className="font-semibold underline underline-offset-4">
          Go to Family
        </Link>
      </div>
      {storytellers.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid="home-storytellers">
          {storytellers.map((s) => (
            <li key={s.voiceId}>
              <Link href={s.href} className="-mx-2 flex items-center gap-3 rounded-2xl p-2 hover:bg-ivory">
                <StorytellerAvatar name={s.person.name} avatarUrl={s.person.avatarUrl} tint={s.person.tint} size="sm" muted={s.tone === "waiting"} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-display text-lg font-semibold">
                    {s.person.name}
                    {s.mine && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="text-sm text-muted">{s.detail}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold ${STATUS[s.tone].className}`}>{STATUS[s.tone].label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No storytellers yet. Invite a grandparent, aunt or uncle to record their voice.</p>
      )}
      {slotLine && <p className="text-sm text-muted">{slotLine}</p>}
      <Link
        href="/family/narrators#invite"
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border-2 border-ink/20 px-4 font-display font-semibold hover:border-ink/50"
      >
        <span aria-hidden="true">+</span> Invite a storyteller
      </Link>
    </section>
  );
}

/** Prepared audiobooks no child can hear yet, each with the one step that puts it on a bookshelf. */
export function UnassignedBooks({ books }: { books: UnassignedBook[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="unassigned-h" data-testid="unassigned-books">
      <h2 id="unassigned-h" className="font-display text-2xl font-semibold">
        Prepared, not on a bookshelf yet
      </h2>
      <ul className="divide-y-2 divide-ink/5 rounded-3xl bg-surface px-4 ring-2 ring-ink/10">
        {books.map((b) => (
          <li key={b.slug} className="flex items-center gap-4 py-4" data-testid={`unassigned-book-${b.slug}`}>
            <span className="block w-16 shrink-0 overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)] sm:w-20">
              {b.coverUrl ? (
                <Image src={b.coverUrl} alt="" width={80} height={107} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <span className={`flex aspect-[3/4] w-full items-center justify-center p-2 text-center font-display text-xs font-semibold ${b.tint}`}>{b.title}</span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <p className="font-display text-xl font-semibold leading-tight">{b.title}</p>
                <p className="text-sm text-muted">
                  Read by {names(b.narrators.map((n) => n.name))} · about {b.minutes} min
                </p>
                <p className="text-sm font-semibold">{b.detail}</p>
              </div>
              <Link
                href={b.href}
                className="inline-flex min-h-11 shrink-0 items-center self-start rounded-xl border-2 border-ink px-5 font-display font-semibold hover:-translate-y-0.5 sm:self-center"
              >
                Choose who hears it<span className="sr-only">: {b.title}</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
