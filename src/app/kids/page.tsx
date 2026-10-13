import type { Metadata } from "next";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { FavoriteButton } from "@/components/family/FavoriteButton";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { KidsDeviceFooter, ListenerPicker } from "@/components/family/KidsDeviceControls";
import { cookies } from "next/headers";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { buttonPrimary } from "@/components/brand/buttons";
import { CATALOG } from "@/lib/library/catalog";
import { familyStore } from "@/lib/family/session";
import { narratorsFor } from "@/lib/family/service";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import { bookText } from "@/lib/narration/text";
import { pageCount, pageOf } from "@/lib/player/pages";
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
  // Kids browse the family's books and listen to what's already prepared; they can't start generation.
  const store = (await familyStore(page.session!))!;
  const narrators = await narratorsFor(store, actor!, child.id);
  const nameOf = new Map(narrators.map((n) => [n.voiceId, n]));
  const books = await Promise.all(
    CATALOG.map(async (b) => {
      const readiness = await kidsReadiness(store, actor!, child.id, b.slug);
      const voices = readiness.filter((r) => r.readySentenceIds.length > 0).map((r) => nameOf.get(r.voiceId)?.name).filter((n): n is string => Boolean(n));
      return { book: b, voices };
    }),
  );
  const ready = books.filter((b) => b.voices.length > 0);
  const waiting = books.filter((b) => b.voices.length === 0);
  // The story this child was last in the middle of, if it can still be played.
  const last = page.state!.progress
    .filter((p) => p.childId === child.id && p.sentence > 0 && ready.some((b) => b.book.slug === p.bookSlug))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const resume = last ? ready.find((b) => b.book.slug === last.bookSlug)!.book : null;
  const reader = last?.voiceId ? nameOf.get(last.voiceId) : undefined;
  const total = resume ? (bookText(resume.slug)?.sentences.length ?? 1) : 1;
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={child.nickname} avatarUrl={null} tint={child.tint} size="md" />
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Hi {child.nickname}! Pick a story.</h1>
      </div>

      {resume && last && (
        <Link
          href={`/kids/listen/${resume.slug}`}
          data-testid="kids-continue"
          className="grid gap-4 rounded-[28px] bg-night p-4 text-night-ink sm:grid-cols-[180px_1fr] sm:items-center sm:p-5"
        >
          <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-bookcase sm:aspect-square">
            {resume.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
              <img src={resume.coverUrl} alt="" className="size-full object-cover" />
            )}
            <span className="absolute inset-x-3 bottom-3 h-2 overflow-hidden rounded-full bg-white/60">
              <span className="block h-full bg-coral-strong" style={{ width: `${Math.round(((last.sentence + 1) / total) * 100)}%` }} />
            </span>
          </span>
          <span className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wider text-night-muted uppercase">Keep listening</span>
            <span className="font-display text-2xl font-semibold sm:text-3xl">{resume.title}</span>
            <span className="flex items-center gap-2 font-semibold text-night-muted">
              {reader && <StorytellerAvatar name={reader.name} avatarUrl={reader.avatarUrl} tint={reader.tint} size="sm" />}
              {reader ? `${reader.name} is reading · ` : ""}page {pageOf(last.sentence) + 1} of {pageCount(total)}
            </span>
            <span className="mt-1 self-start rounded-full bg-coral-strong px-5 py-2 font-display text-lg font-semibold text-white">▶ Play</span>
          </span>
        </Link>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="my-stories-h">
        <h2 id="my-stories-h" className="font-display text-2xl font-semibold">My stories</h2>
        {ready.length === 0 && <p className="text-lg">No stories are ready yet. Ask a grown-up to prepare one for you.</p>}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {ready.map(({ book: b, voices }) => (
            <li key={b.slug} className="relative">
              <Link href={`/kids/listen/${b.slug}`} className="group flex flex-col gap-2">
                <Cover url={b.coverUrl} tint={b.tint} title={b.title} />
                <span className="font-display text-lg leading-tight font-semibold">{b.title}</span>
                <span className="text-sm text-muted">
                  <span className="sr-only">Ready to listen, </span>with {voices.join(" or ")}
                </span>
              </Link>
              <span className="absolute top-2 right-2 rounded-full bg-surface/90">
                <FavoriteButton childId={child.id} bookSlug={b.slug} title={b.title} initial={favorites.has(b.slug)} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {waiting.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="ask-h">
          <h2 id="ask-h" className="font-display text-2xl font-semibold">Ask a grown-up</h2>
          <p className="text-muted">These stories aren&apos;t ready yet. A grown-up can prepare them for you.</p>
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {waiting.map(({ book: b }) => (
              <li key={b.slug}>
                <Link href={`/kids/listen/${b.slug}`} className="flex flex-col gap-1.5 opacity-75 hover:opacity-100">
                  <Cover url={b.coverUrl} tint={b.tint} title={b.title} />
                  <span className="font-display text-sm leading-tight font-semibold">{b.title}</span>
                  <span className="text-xs text-muted">Ask a grown-up to prepare it</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {device ? (
        <KidsDeviceFooter canSwitch={deviceKids.length > 1} />
      ) : (
        <Link href="/family" className="self-start text-sm font-semibold underline underline-offset-4">
          Grown-ups
        </Link>
      )}
    </main>
  );
}

function Cover({ url, tint, title }: { url: string | null; tint: string; title: string }) {
  return (
    <span className={`relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-[0_4px_0_rgb(40_53_72/0.12)] ring-2 ring-ink/10 ${tint}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center p-2 text-center font-display font-semibold">{title}</span>
      )}
    </span>
  );
}

/** A device whose Readli Kids was ended by a parent, or unused for 90 days. */
function DeviceEnded() {
  return (
    <FamilyShell portal={false}>
      <h1 className="font-display text-4xl font-semibold">Ask a grown-up</h1>
      <p className="text-lg">Readli Kids has ended on this device. A grown-up can sign in and set it up again.</p>
      <Link href="/login" className={`${buttonPrimary} self-start`}>
        Grown-ups: sign in
      </Link>
    </FamilyShell>
  );
}
