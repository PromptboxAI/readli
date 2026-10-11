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

/** A play button and waveform for the contributor's approved sample. Static in the design. */
export function SamplePlayer({ label, length = "0:24" }: { label: string; length?: string }) {
  const bars = [6, 12, 20, 14, 26, 18, 30, 22, 12, 24, 16, 28, 20, 10, 22, 14, 26, 18, 8, 16, 24, 12, 20, 10];
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <button type="button" aria-label={`Play ${label}`} className="grid size-14 shrink-0 place-items-center rounded-full bg-coral-deep text-white shadow-[0_4px_0_#8f2a1e]">
        <svg viewBox="0 0 24 24" className="ml-1 size-6" aria-hidden="true">
          <path d="M6 4l14 8-14 8z" fill="currentColor" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-display font-semibold">{label}</span>
        <span className="flex h-8 items-center gap-[3px] overflow-hidden" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} className={`w-1.5 rounded-full ${i < 7 ? "bg-coral-deep" : "bg-ink/25"}`} style={{ height: h }} />
          ))}
        </span>
      </div>
      <span className="text-sm tabular-nums text-muted">{length}</span>
    </div>
  );
}
