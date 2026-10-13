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
  const books = await Promise.all(
    CATALOG.map(async (b) => ({ book: b, ready: (await kidsReadiness(store, actor!, child.id, b.slug)).some((r) => r.readySentenceIds.length > 0) })),
  );
  books.sort((a, b) => Number(b.ready) - Number(a.ready));
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <ReadiMascot size={110} decorative />
        <h1 className="font-display text-4xl font-semibold">Hi {child.nickname}! Pick a story.</h1>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {books.map(({ book: b, ready }) => (
          <li key={b.slug} className="flex h-full items-start gap-1 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 hover:ring-ink">
            <Link href={`/kids/listen/${b.slug}`} className="flex min-w-0 flex-1 flex-col gap-1 p-2">
              <span className="font-display text-xl font-semibold">{b.title}</span>
              <span className="text-sm text-muted">{b.author}</span>
              <span className={`mt-1 self-start rounded-full px-2 py-0.5 text-xs font-bold ${ready ? "bg-mint" : "bg-ink/10"}`}>
                {ready ? "Ready to listen" : "Ask a grown-up to prepare it"}
              </span>
            </Link>
            <FavoriteButton childId={child.id} bookSlug={b.slug} title={b.title} initial={favorites.has(b.slug)} />
          </li>
        ))}
      </ul>
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
