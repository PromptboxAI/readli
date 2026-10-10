import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { buttonPrimary } from "@/components/brand/buttons";
import { currentSession } from "@/lib/family/session";

export function FamilyShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6">{children}</main>
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
    <FamilyShell>
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
    <FamilyShell>
      <h1 className="font-display text-4xl font-semibold">Ask a grown-up</h1>
      <p className="text-lg">{text}</p>
      <Link href="/family" className={`${buttonPrimary} self-start`}>
        Grown-ups: sign in
      </Link>
    </FamilyShell>
  );
}
