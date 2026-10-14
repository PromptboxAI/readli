import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { FavoriteButton } from "@/components/family/FavoriteButton";
import { FamilyOff, FamilyShell, GrownUpSignIn, NeedsGrownUp } from "@/components/family/FamilyShell";
import { KidsDeviceFooter, ListenerPicker, TemporaryKidsExit } from "@/components/family/KidsDeviceControls";
import { cookies } from "next/headers";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { CATALOG, type CatalogBook } from "@/lib/library/catalog";
import { familyStore } from "@/lib/family/session";
import { kidsReadiness } from "@/lib/narration/narration";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Readli Kids" };

/** A child's bookshelf. Kids never sign in: a guardian opens this profile from Readli Family. */
export default async function KidsHome() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const actor = page.session?.actor;
  const device = page.session?.device;
  if (!page.session && (await cookies()).get(KIDS_COOKIE)?.value) return <DeviceEnded />;
  const deviceKids = device && page.state ? device.childIds.map((id) => activeChild(page.state!, id)).filter((c): c is NonNullable<typeof c> => c !== null) : [];
  const child = actor?.kind === "child" && page.state ? activeChild(page.state, actor.childId) : null;
  if (device && !child) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <ReadiMascot size={110} decorative />
          <h1 className="font-display text-4xl font-semibold">Who&apos;s listening?</h1>
        </div>
        <ListenerPicker kids={deviceKids.map((c) => ({ id: c.id, nickname: c.nickname, tint: c.tint }))} />
        <KidsDeviceFooter canSwitch={false} />
      </main>
    );
  }
  if (!child) return <NeedsGrownUp text="A grown-up opens your Readli Kids bookshelf for you." />;
  const favorites = new Set(page.state!.favorites.filter((f) => f.childId === child.id).map((f) => f.bookSlug));
  const progress = new Map(page.state!.progress.filter((p) => p.childId === child.id).map((p) => [p.bookSlug, p]));
  // Kids listen to what a grown-up has fully prepared in a voice they may hear; they can't start generation.
  const store = (await familyStore(page.session!))!;
  const books = await Promise.all(
    CATALOG.map(async (b) => ({ book: b, ready: (await kidsReadiness(store, actor!, child.id, b.slug)).some((r) => r.readiness === "ready") })),
  );
  const ready = books.filter((b) => b.ready).map((b) => b.book);
  const started = ready
    .filter((b) => (progress.get(b.slug)?.sentence ?? 0) > 0)
    .sort((a, b) => progress.get(b.slug)!.updatedAt.localeCompare(progress.get(a.slug)!.updatedAt));
  const fresh = ready.filter((b) => !started.includes(b));
  const later = books.filter((b) => !b.ready).map((b) => b.book);
  const shelf = (id: string, title: string, list: CatalogBook[]) => (
    <section className="flex flex-col gap-4" aria-labelledby={`${id}-h`} data-testid={`kids-${id}`}>
      <h2 id={`${id}-h`} className="font-display text-3xl font-semibold">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((b) => (
          <li key={b.slug} className="relative">
            <Link href={`/kids/listen/${b.slug}`} className="flex flex-col gap-2 rounded-3xl p-1 hover:ring-4 hover:ring-sunshine focus-visible:ring-4">
              <Cover book={b} />
              <span className="px-1 font-display text-xl font-semibold leading-tight">{b.title}</span>
            </Link>
            <span className="absolute right-2 top-2">
              <FavoriteButton childId={child.id} bookSlug={b.slug} title={b.title} initial={favorites.has(b.slug)} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <ReadiMascot size={110} decorative />
        <h1 className="font-display text-4xl font-semibold">Hi {child.nickname}! Pick a story.</h1>
      </div>
      {ready.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-panel bg-surface p-8 text-center ring-2 ring-ink/10" data-testid="kids-empty">
          <h2 className="font-display text-3xl font-semibold">No stories ready yet</h2>
          <p className="max-w-md text-lg">Ask a grown-up to get a story ready for you. It will be right here when it&apos;s done.</p>
        </div>
      ) : (
        <>
          {started.length > 0 && shelf("continue", "Continue listening", started)}
          {fresh.length > 0 && shelf("ready", "Ready to listen", fresh)}
        </>
      )}
      {later.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="discover-h" data-testid="kids-discover">
          <h2 id="discover-h" className="font-display text-2xl font-semibold">
            More stories
          </h2>
          <p className="text-muted">A grown-up can get these ready for you.</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {later.map((b) => (
              <li key={b.slug} className="flex flex-col gap-1 opacity-80" aria-label={`${b.title}: a grown-up can get this one ready`}>
                <Cover book={b} />
                <span className="text-sm font-semibold leading-tight">{b.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {device ? (
        <KidsDeviceFooter canSwitch={deviceKids.length > 1} />
      ) : page.session?.temporary ? (
        <TemporaryKidsExit childName={child.nickname} preview={!page.session.account} />
      ) : (
        <GrownUpSignIn />
      )}
    </main>
  );
}

function Cover({ book }: { book: CatalogBook }) {
  return book.coverUrl ? (
    <Image src={book.coverUrl} alt="" width={240} height={320} className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md ring-2 ring-ink/10" />
  ) : (
    <span className={`flex aspect-[3/4] w-full items-center justify-center rounded-2xl p-3 text-center font-display text-lg font-semibold ring-2 ring-ink/10 ${book.tint}`}>{book.title}</span>
  );
}

/** A device whose Readli Kids was ended by a parent, or unused for 90 days. */
function DeviceEnded() {
  return (
    <FamilyShell portal={false}>
      <h1 className="font-display text-4xl font-semibold">Ask a grown-up</h1>
      <p className="text-lg">Readli Kids has ended on this browser. A grown-up can sign in and open it again.</p>
      <GrownUpSignIn />
    </FamilyShell>
  );
}
