import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { buttonPrimary } from "@/components/brand/buttons";
import { ParentNav } from "@/components/family/ParentNav";
import { ReloadOnRestore } from "@/components/family/ReloadOnRestore";
import { PreviewKidsExit } from "@/components/family/KidsDeviceControls";
import { authConfigured } from "@/lib/auth/supabase";
import { currentSession } from "@/lib/family/session";
import { accountBadge, accountInitials, accountLinks, navState } from "@/lib/auth/nav-state";

/**
 * Family pages. A grown-up with a live Readli Family plan gets the Parent Portal's app navigation;
 * everyone else (no plan yet, a kids device, a visitor) keeps the public site header. Pages a kids
 * device can reach pass portal={false}, so the Parent Portal never shows there.
 */
export async function FamilyShell({ children, portal = true, wide = false }: { children: React.ReactNode; portal?: boolean; wide?: boolean }) {
  const width = wide ? "max-w-6xl" : "max-w-4xl";
  const nav = portal ? await navState() : null;
  if (nav?.kind === "adult" && nav.family.plan !== "none") {
    const account = { name: nav.name, email: nav.email, initials: accountInitials(nav.name), avatarUrl: nav.avatarUrl ?? null, badge: accountBadge(nav), links: accountLinks(nav) };
    return (
      <>
        <ReloadOnRestore />
        <ParentNav account={account} />
        <main className={`mx-auto flex ${width} flex-col gap-8 px-4 py-12 sm:px-6`}>{children}</main>
        <SiteFooter />
        {/* Room for the phone bottom bar, so it never covers the footer. */}
        <div aria-hidden="true" className="h-20 md:hidden" />
      </>
    );
  }
  return (
    <>
      {portal && <ReloadOnRestore />}
      <SiteHeader />
      <main className={`mx-auto flex ${width} flex-col gap-8 px-4 py-12 sm:px-6`}>{children}</main>
      <SiteFooter />
    </>
  );
}

/** Shown on preview pages only; a signed-in grown-up's family is real. */
export async function PreviewNote() {
  if ((await currentSession())?.account) return null;
  return (
    <p className="rounded-2xl bg-sunshine/60 p-3 text-sm font-semibold">
      Preview family: these people are examples, and family accounts with real sign-in are coming soon.
    </p>
  );
}

export function FamilyOff() {
  return (
    <FamilyShell portal={false}>
      <h1 className="font-display text-4xl font-semibold">Family accounts are coming soon</h1>
      <p className="text-lg">You can already record your voice and hear a story read by you.</p>
      <Link href="/try" className={`${buttonPrimary} self-start`}>
        Try your voice
      </Link>
    </FamilyShell>
  );
}

export function NeedsGrownUp({ text }: { text: string }) {
  return (
    <FamilyShell portal={false}>
      <h1 className="font-display text-4xl font-semibold">Ask a grown-up</h1>
      <p className="text-lg">{text}</p>
      <GrownUpSignIn />
    </FamilyShell>
  );
}

/**
 * The way back to Readli Family from a kids screen. Signing in is the real exit (it ends Kids Mode on
 * this browser); a link to /family would only bounce back to the bookshelf. The preview has no
 * sign-in, so there it starts a fresh preview family instead.
 */
export function GrownUpSignIn() {
  if (!authConfigured()) return <PreviewKidsExit />;
  return (
    <Link href="/login?next=/family" className={`${buttonPrimary} self-start`}>
      Grown-ups: sign in
    </Link>
  );
}
