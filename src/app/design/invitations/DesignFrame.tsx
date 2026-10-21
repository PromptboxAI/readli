import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";

const SCREENS = [
  { href: "/design/invitations", label: "1. Invite your family" },
  { href: "/design/invitations/email", label: "2. Invitation email" },
  { href: "/design/invitations/preview", label: "3. Voice preview page" },
  { href: "/design/invitations/accept", label: "4. Family Circle" },
];

/** Design review frame: a banner that says nothing here is live, and links between the four screens. */
export function DesignFrame({ current, children, chrome = true }: { current: string; children: React.ReactNode; chrome?: boolean }) {
  return (
    <>
      <div className="bg-ink px-4 py-3 text-sm text-white sm:px-6" data-testid="design-banner">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold">Design for review.</span> Family Invitation &amp; Voice Preview. Nothing here sends, saves or charges.
          </p>
          <nav aria-label="Design screens" className="flex flex-wrap gap-x-4 gap-y-1">
            {SCREENS.map((s) => (
              <Link key={s.href} href={s.href} aria-current={s.href === current ? "page" : undefined} className={`underline-offset-4 hover:underline ${s.href === current ? "font-semibold underline" : "opacity-80"}`}>
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {chrome && <SiteHeader />}
      {children}
      {chrome && <SiteFooter />}
    </>
  );
}

export function renewalDate(trialDays: number, from = new Date()): string {
  return new Date(from.getTime() + trialDays * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export { SamplePlayer } from "./SamplePlayer";
