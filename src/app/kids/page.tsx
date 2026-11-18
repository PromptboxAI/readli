import type { Metadata } from "next";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { KidsCover } from "@/components/family/KidsCover";
import { KidsOffline } from "@/components/family/KidsOffline";
import { KidsShelfGrid } from "@/components/family/KidsShelfGrid";
import { FamilyOff, FamilyShell, GrownUpSignIn, NeedsGrownUp } from "@/components/family/FamilyShell";
import { KidsDeviceFooter, ListenerPicker, TemporaryKidsExit } from "@/components/family/KidsDeviceControls";
import { cookies } from "next/headers";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { familyStore } from "@/lib/family/session";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import { pageCount, pageOf } from "@/lib/player/pages";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { kidsShelf, type ShelfBook } from "@/lib/kids/shelf";
import type { KidsShelfItem } from "@/components/family/KidsShelfGrid";

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
  // Kids browse the family's books and listen to what's already prepared; they can't start generation.
  const store = (await familyStore(page.session!))!;
  const { resume: shelfResume, newest, ready, waiting } = await kidsShelf(store, actor!, page.state!, child.id);
  const resume = shelfResume?.book ?? null;
  const last = shelfResume?.progress;
  const reader = shelfResume?.reader;
  const total = shelfResume?.total ?? 1;
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={child.nickname} avatarUrl={null} tint={child.tint} size="md" />
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Hi {child.nickname}! Pick a story.</h1>
      </div>
      <KidsOffline childId={child.id} banner />

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
            <span className="text-xs font-bold tracking-wider text-night-muted uppercase">Continue listening</span>
            <span className="font-display text-2xl font-semibold sm:text-3xl">{resume.title}</span>
            <span className="flex items-center gap-2 font-semibold text-night-muted">
              {reader && <StorytellerAvatar name={reader.name} avatarUrl={reader.avatarUrl} tint={reader.tint} size="sm" />}
              {reader ? `${reader.name} is reading · ` : ""}page {pageOf(last.sentence) + 1} of {pageCount(total)}
            </span>
            <span className="mt-1 self-start rounded-full bg-coral-strong px-5 py-2 font-display text-lg font-semibold text-white">▶ Play</span>
          </span>
        </Link>
      )}

      <KidsShelfGrid
        childId={child.id}
        showEmpty={!resume}
        newest={newest.map(toItem)}
        books={ready.map(toItem)}
      />

      {waiting.length > 0 && (
        <Link
          href="/kids/discover"
          className="grid items-center gap-3 rounded-3xl bg-surface p-4 outline-2 -outline-offset-2 outline-ink/20 outline-dashed sm:grid-cols-[auto_1fr_auto] sm:gap-6 sm:px-5"
          data-testid="kids-discover"
        >
          <span className="flex" aria-hidden="true">
            {waiting.slice(0, 5).map((b) => (
              <span key={b.slug} className="-mr-1.5 w-12 overflow-hidden rounded-lg border-2 border-surface shadow-[0_2px_0_rgb(40_53_72/0.12)]">
                <KidsCover url={b.coverUrl} tint={b.tint} title="" />
              </span>
            ))}
          </span>
          <span className="flex flex-col">
            <span className="font-display text-xl font-semibold">Discover more stories</span>
            <span className="text-muted">
              {waiting.length} more {waiting.length === 1 ? "story" : "stories"} a grown-up can get ready for you.
            </span>
          </span>
          <span className="inline-flex min-h-12 items-center self-start rounded-full border-[3px] border-ink px-5 font-display text-lg font-semibold sm:self-center">
            Take a look
          </span>
        </Link>
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

function toItem({ book: b, voices, favorite }: ShelfBook): KidsShelfItem {
  return { slug: b.slug, title: b.title, coverUrl: b.coverUrl, tint: b.tint, voices, favorite };
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
