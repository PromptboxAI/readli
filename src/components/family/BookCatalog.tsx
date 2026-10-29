"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { parentSecondary } from "@/components/brand/buttons";
import type { LibraryCard } from "@/lib/library/discovery";
import { displayCredits } from "@/lib/narration/credits";

type Filter = "all" | "ready" | "quick" | "bedtime" | "longer" | "fits";
type Sort = "shortest" | "longest" | "title";
const filtersIds: Filter[] = ["all", "ready", "quick", "bedtime", "longer", "fits"];

const PAGE = 12;
const SORTS: Sort[] = ["shortest", "longest", "title"];
/** The catalog's choices this visit, so coming back from a book finds the same view and place. */
const STATE_KEY = "readli:catalog";
const SCROLL_KEY = "readli:catalog-scroll";

type View = { q: string; filter: Filter; sort: Sort; voice: string; shown: number };

function savedView(): Partial<View> {
  try {
    return JSON.parse(window.sessionStorage.getItem(STATE_KEY) ?? "{}") as Partial<View>;
  } catch {
    return {};
  }
}

/**
 * The whole family library as one catalog: search, a few simple filters, and what each book costs to prepare
 * in the storyteller you choose. Filters are views the parent picks; the default shows every book, shortest
 * first, and never hides one because the family is short of credits.
 */
export function BookCatalog({
  books,
  unitsPerCredit,
  quickMaxMinutes,
  bedtime,
  initialVoice = null,
}: {
  books: LibraryCard[];
  unitsPerCredit: number;
  quickMaxMinutes: number;
  bedtime: string[];
  /** A storyteller to show costs for first, such as one a parent just approved. */
  initialVoice?: string | null;
}) {
  // Your own voice first, then whoever has the most books ready, so the costs shown start from the likeliest choice.
  const narrators = useMemo(() => {
    const seen = new Map<string, { voiceId: string; name: string; yours: boolean; ready: number }>();
    for (const b of books)
      for (const n of b.narrators) {
        const v = seen.get(n.voiceId) ?? { voiceId: n.voiceId, name: n.name, yours: n.yours, ready: 0 };
        if (n.availability === "ready") v.ready += 1;
        seen.set(n.voiceId, v);
      }
    return [...seen.values()].sort((a, b) => Number(b.yours) - Number(a.yours) || b.ready - a.ready);
  }, [books]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("shortest");
  const [voiceId, setVoiceId] = useState((initialVoice && narrators.find((n) => n.voiceId === initialVoice)?.voiceId) ?? narrators[0]?.voiceId ?? "");
  const [shown, setShown] = useState(PAGE);

  // Coming back to Books from a book (Back, or the book page's link) brings back the same search, filter,
  // sort, storyteller, how far the list was opened and the scroll position. Opening Books afresh starts clean.
  useEffect(() => {
    let y = NaN;
    try {
      y = Number(window.sessionStorage.getItem(SCROLL_KEY) ?? "NaN");
      window.sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* Storage blocked: the catalog opens at the top with the default view. */
    }
    if (!Number.isFinite(y)) return;
    const v = savedView();
    if (typeof v.q === "string") setQuery(v.q);
    if (v.filter && filtersIds.includes(v.filter)) setFilter(v.filter);
    if (v.sort && SORTS.includes(v.sort)) setSort(v.sort);
    if (v.voice && narrators.some((n) => n.voiceId === v.voice)) setVoiceId(v.voice);
    if (typeof v.shown === "number" && v.shown > PAGE) setShown(v.shown);
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, [narrators]);

  // Runs after the effect above has read what was saved, so it only ever overwrites it with the current view.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STATE_KEY, JSON.stringify({ q: query, filter, sort, voice: voiceId, shown } satisfies View));
    } catch {
      /* Storage blocked: coming back shows the default view. */
    }
  }, [query, filter, sort, voiceId, shown]);
  const rememberPlace = () => {
    try {
      window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* Storage blocked: coming back opens at the top. */
    }
  };

  const credits = (units: number) => displayCredits(units, unitsPerCredit).toLocaleString("en-US");
  const inVoice = (b: LibraryCard) => b.narrators.find((n) => n.voiceId === voiceId);
  const filters: { id: Filter; label: string; keep: (b: LibraryCard) => boolean }[] = [
    { id: "all", label: "All", keep: () => true },
    { id: "ready", label: "Ready to play", keep: (b) => ["ready", "partial"].includes(inVoice(b)?.availability ?? "") },
    { id: "quick", label: "Quick stories", keep: (b) => b.minutes <= quickMaxMinutes },
    { id: "bedtime", label: "Bedtime favorites", keep: (b) => bedtime.includes(b.slug) },
    { id: "longer", label: "Longer adventures", keep: (b) => b.minutes > quickMaxMinutes },
    { id: "fits", label: "Fits my credits", keep: (b) => inVoice(b)?.availability === "available" },
  ];

  const q = query.trim().toLowerCase();
  const keep = filters.find((f) => f.id === filter)!.keep;
  const list = books
    .filter((b) => keep(b) && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)))
    .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : sort === "longest" ? b.minutes - a.minutes : a.minutes - b.minutes));
  const voiceName = narrators.find((n) => n.voiceId === voiceId)?.name;

  const cost = (b: LibraryCard) => {
    const n = inVoice(b);
    if (!n) return <span className="text-muted">Not available in this voice</span>;
    if (n.availability === "ready") return (
        <span className="font-bold">
          <span aria-hidden="true" className="text-mint-deep">
            ●{" "}
          </span>
          Ready · free to play
        </span>
      );
    if (n.availability === "preparing") return <span className="font-bold">Preparing now</span>;
    if (n.availability === "partial") return <span className="font-bold">Partly ready · {credits(n.missingCredits)} credits for the rest</span>;
    return (
      <span className="font-bold">
        {credits(n.missingCredits)} credits to prepare
        {n.availability === "needs_credits" && <span className="block font-semibold text-coral-deep">More credits needed</span>}
      </span>
    );
  };

  const select = "min-h-11 rounded-2xl border-2 border-ink/20 bg-surface px-3 font-semibold text-ink";
  return (
    <div className="flex flex-col gap-5" data-testid="catalog">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-center lg:gap-x-4 lg:gap-y-4">
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border-2 border-ink/20 bg-surface px-4 lg:col-start-1 lg:row-start-1">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">Search books</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder={`Search ${books.length} stories`}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none"
          />
        </label>
        <div role="group" aria-label="Filters" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:col-span-2 lg:row-start-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setShown(PAGE);
              }}
              className={`min-h-11 shrink-0 rounded-full border-2 px-4 font-display font-semibold whitespace-nowrap ${filter === f.id ? "border-ink bg-ink text-white" : "border-ink/20 bg-surface hover:border-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 lg:col-start-2 lg:row-start-1">
          {narrators.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Costs for
              <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={select}>
                {narrators.map((n) => (
                  <option key={n.voiceId} value={n.voiceId}>
                    {n.yours ? `${n.name} (your voice)` : n.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={select}>
              <option value="shortest">Shortest first</option>
              <option value="longest">Longest first</option>
              <option value="title">A to Z</option>
            </select>
          </label>
        </div>
      </div>

      <p className="text-sm text-muted">
        Costs are for {voiceName ?? "the storyteller you choose"}. You only pay for what isn&apos;t prepared yet in that voice, and listening again never costs credits.
      </p>

      {list.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 font-semibold ring-2 ring-ink/10" data-testid="catalog-empty">
          No stories match. Try another search or filter.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.slice(0, shown).map((b) => (
            <li key={b.slug} className="min-w-0">
              <Link href={`/family/books/${b.slug}${voiceId ? `?voice=${encodeURIComponent(voiceId)}` : ""}`} onClick={rememberPlace} className="group flex h-full flex-col gap-1.5 rounded-2xl outline-offset-4" data-testid={`book-${b.slug}`}>
                {b.coverUrl ? (
                  <Image src={b.coverUrl} alt="" width={180} height={240} className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md group-hover:ring-4 group-hover:ring-ink" />
                ) : (
                  <span className={`flex aspect-[3/4] w-full items-center justify-center rounded-2xl p-3 text-center font-display text-lg font-semibold ${b.tint}`}>{b.title}</span>
                )}
                <span className="line-clamp-2 font-display text-lg leading-tight font-semibold group-hover:underline">{b.title}</span>
                <span className="text-sm text-muted">
                  {b.minutes < 1 ? "Under a minute" : `About ${Math.round(b.minutes)} min`}
                  {b.chapters > 1 ? ` · ${b.chapters} chapters` : ""}
                </span>
                <span className="text-sm" data-testid="cost">
                  {cost(b)}
                </span>
                {inVoice(b)?.update && (
                  <span className="w-fit rounded-full bg-sunshine px-2.5 py-0.5 text-xs font-semibold text-ink" data-testid="update-badge">
                    Update available
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
          <span className="text-sm text-muted" data-testid="catalog-count">
            Showing {Math.min(shown, list.length)} of {list.length}
          </span>
          {shown < list.length && (
            <button type="button" className={parentSecondary} onClick={() => setShown((s) => s + PAGE)}>
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
