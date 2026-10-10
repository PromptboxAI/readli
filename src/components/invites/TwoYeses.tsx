import { TwoYesesArt } from "@/components/invites/illustrations";

/** Explains the two-level voice permission: the voice owner says yes, then a parent says yes for each child. */
export function TwoYeses({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="two-yeses" className={`flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10 ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <h2 id="two-yeses" className="font-display text-2xl font-semibold">
        Two yeses before anyone listens
      </h2>
      <TwoYesesArt className="mx-auto w-full max-w-xs" />
      <ol className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-2xl bg-lavender/40 p-4">
          <span className="font-display font-semibold">1. The voice owner says yes.</span> Each storyteller records and owns
          their voice, and chooses whether to share it with your family.
        </li>
        <li className="rounded-2xl bg-mint/50 p-4">
          <span className="font-display font-semibold">2. A parent says yes for each child.</span> You choose which of your
          children can hear each storyteller, and can change it any time.
        </li>
      </ol>
    </section>
  );
}
