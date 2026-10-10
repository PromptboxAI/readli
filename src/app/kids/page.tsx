import type { Metadata } from "next";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { FavoriteButton } from "@/components/family/FavoriteButton";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { DEMO_BOOKS } from "@/lib/content/demo-books";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Readli Kids | Readli" };

/** A child's bookshelf. Kids never sign in: a guardian opens this profile from Readli Family. */
export default async function KidsHome() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const actor = page.session?.actor;
  const child = actor?.kind === "child" && page.state ? activeChild(page.state, actor.childId) : null;
  if (!child) return <NeedsGrownUp text="A grown-up opens your Readli Kids bookshelf for you." />;
  const favorites = new Set(page.state!.favorites.filter((f) => f.childId === child.id).map((f) => f.bookSlug));
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4">
        <ReadiMascot size={110} decorative />
        <h1 className="font-display text-4xl font-semibold">Hi {child.nickname}! Pick a story.</h1>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {DEMO_BOOKS.filter((b) => b.passageText).map((b) => (
          <li key={b.slug} className="flex h-full items-start gap-1 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 hover:ring-ink">
            <Link href={`/kids/listen/${b.slug}`} className="flex min-w-0 flex-1 flex-col gap-1 p-2">
              <span className="font-display text-xl font-semibold">{b.title}</span>
              <span className="text-sm text-muted">{b.author}</span>
            </Link>
            <FavoriteButton childId={child.id} bookSlug={b.slug} title={b.title} initial={favorites.has(b.slug)} />
          </li>
        ))}
      </ul>
      <Link href="/family" className="self-start text-sm font-semibold underline underline-offset-4">
        Grown-ups
      </Link>
    </main>
  );
}
