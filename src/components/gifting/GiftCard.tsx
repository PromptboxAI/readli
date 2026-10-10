import { GiftBoxArt } from "@/components/invites/illustrations";
import type { GiftPlan } from "@/lib/gifting/plans";

/** The gift as the recipient will see it: who it's from, what it is and the note. */
export function GiftCard({ plan, to, from, message, open = false }: { plan: GiftPlan; to: string; from: string; message: string; open?: boolean }) {
  return (
    <figure className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[var(--radius-panel)] bg-coral/25 p-6 text-center ring-2 ring-ink/10 sm:p-8" data-testid="gift-card">
      <span aria-hidden="true" className="absolute -left-6 -top-6 size-24 rounded-full bg-sunshine/60" />
      <span aria-hidden="true" className="absolute -bottom-8 -right-4 size-28 rounded-[40%] bg-mint/70" />
      <GiftBoxArt className="relative w-28" open={open} />
      <p className="relative font-display text-lg">For {to}</p>
      <p className="relative font-display text-3xl font-semibold">
        {plan.kind === "recurring" ? "Readli, every month" : `${plan.name} of Readli`}
      </p>
      {message && <blockquote className="relative max-w-sm rounded-2xl bg-surface/90 p-4 italic">&ldquo;{message}&rdquo;</blockquote>}
      <figcaption className="relative font-display font-semibold">From {from}</figcaption>
    </figure>
  );
}
