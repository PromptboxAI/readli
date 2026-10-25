import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { familyStore } from "@/lib/family/session";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { planConfig } from "@/lib/family/plan";
import { kidsShelf } from "@/lib/kids/shelf";
import { childRequests } from "@/lib/family/service";
import { bookOpening } from "@/lib/library/opening";
import { bookMinutes } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import { AskButton } from "@/components/family/AskButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peek inside | Readli Kids" };

/** A peek at one book that isn't ready for this child yet: its cover, length and first few lines. Asking is the only action. */
export default async function KidsBookPreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await familyPage();
  if (!page.enabled) redirect("/kids");
  const actor = page.session?.actor;
  const child = actor?.kind === "child" && page.state ? activeChild(page.state, actor.childId) : null;
  if (!child) redirect("/kids");
  const store = (await familyStore(page.session!))!;
  const { resume, ready, waiting } = await kidsShelf(store, actor!, page.state!, child.id);
  if (resume?.book.slug === slug || ready.some((b) => b.book.slug === slug)) redirect(`/kids/listen/${slug}`);
  const book = waiting.find((b) => b.slug === slug);
  const text = bookText(slug);
  if (!book || !text) notFound();
  const asked = (await childRequests(store, actor!, child.id)).includes(slug);
  const minutes = bookMinutes(text, planConfig());
  const opening = bookOpening(slug);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4 py-8 sm:px-6">
      <Link href="/kids/discover" className="inline-flex min-h-11 items-center gap-2 self-start font-display text-lg font-semibold" data-testid="back-link">
        <span aria-hidden="true">‹</span> Discover
      </Link>
      <span className={`block aspect-[3/4] w-56 self-center overflow-hidden rounded-3xl shadow-[0_10px_0_var(--color-wood)] ring-[3px] ring-ink/10 sm:w-64 ${book.tint}`}>
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
          <img src={book.coverUrl} alt={`Cover of ${book.title}`} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center p-4 text-center font-display text-2xl font-semibold">{book.title}</span>
        )}
      </span>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{book.title}</h1>
        <p className="text-lg text-muted">by {book.author}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-mint px-4 py-1.5 font-display font-semibold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        {minutes < 1 ? "Under a minute" : `About ${Math.round(minutes)} minutes`}
      </span>
      {opening.length > 0 && (
        <section aria-labelledby="starts-h" className="flex flex-col gap-3 rounded-3xl border-[3px] border-ink bg-surface p-5" data-testid="kids-opening">
          <h2 id="starts-h" className="font-display text-xl font-semibold">
            How it starts
          </h2>
          {opening.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed whitespace-pre-line">
              {p}
            </p>
          ))}
        </section>
      )}
      <p className="text-center text-lg">Want to hear what happens next?</p>
      <div className="flex flex-col">
        <AskButton childId={child.id} bookSlug={book.slug} title={book.title} initial={asked} size="large" />
      </div>
    </main>
  );
}
